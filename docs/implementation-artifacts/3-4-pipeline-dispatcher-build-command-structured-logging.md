# Story 3.4: Pipeline Dispatcher, Build Command & Structured Logging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want to run `startup-factory build <artifact-path>` and see real-time progress as agents are dispatched through the pipeline,
So that I can kick off a build and monitor its progress.

## Acceptance Criteria

1. **Given** an operator runs `startup-factory build ./planning-artifacts` **When** the build command executes **Then** it validates artifacts (via workspace manager), initializes state, and starts the pipeline dispatcher

2. **Given** the pipeline dispatcher starts with initialized state **When** it processes stories **Then** it reads the state file to find the next pending story **And** dispatches it sequentially through the pipeline phases: storyCreation → development → codeReview → qa **And** updates the state file after each phase completes

3. **Given** a story completes all 4 pipeline phases successfully **When** the state is updated **Then** the story status is set to `completed` and the dispatcher moves to the next story

4. **Given** the pipeline is running **When** agents are dispatched and complete **Then** structured log lines are written to stdout: agent dispatched, story started, phase completed, story completed **And** logs are human-readable by default (e.g., `[22:01:03] Starting story 1-1 with developer agent`) **And** errors and warnings are written to stderr

5. **Given** the Code Reviewer agent returns rejection feedback instead of approval **When** the dispatcher processes the code review result **Then** the story enters the escalation flow as a Capability error (treated the same as a development phase failure) **And** the review feedback is preserved in the workspace for context if the story is retried

6. **Given** the pipeline finishes processing all stories **When** the build completes **Then** the dispatcher updates the run status in the state file and exits with the appropriate exit code (0/1/2)

## Tasks / Subtasks

- [x] Task 1: Implement Logger (AC: #4)
  - [x] 1.1: Create `src/output/logger.ts` — export `log(message: string): void` writing `[HH:MM:SS] {message}\n` to `process.stdout` and `logError(message: string): void` writing `[HH:MM:SS] ERROR: {message}\n` to `process.stderr`. Use `process.stdout.write` / `process.stderr.write` (not `console.log`). Timestamp from `new Date().toLocaleTimeString('en-US', { hour12: false })`.
  - [x] 1.2: Create `src/output/logger.test.ts` — use `vi.spyOn(process.stdout, 'write')` and `vi.spyOn(process.stderr, 'write')`. Verify: `log()` calls stdout with bracket-prefixed message; `logError()` calls stderr with "ERROR:" in message; `log()` does NOT call stderr; `logError()` does NOT call stdout.
  - [x] 1.3: Update `src/output/index.ts` — replace `export {}` with `export { log, logError } from './logger.js'`

- [x] Task 2: Implement Artifact Parser (AC: #1)
  - [x] 2.1: Create `src/workspace/artifact-parser.ts` — export interface `EpicEntry { epicKey: string; storyKeys: string[] }`. Export pure function `parseEpicsContent(content: string): EpicEntry[]`: split on newlines, match `## Epic N:` lines → epicKey `"epic-N"`, match `### Story N.M:` lines → storyKey `"N-M"` under current epic, push each epic when next epic heading or end reached. Export async `parseEpicsFromArtifacts(artifactsPath: string): Promise<EpicEntry[]>`: use `readdir(artifactsPath)` to find file matching `/(epic|stories).*\.md$/i`, throw if not found, `readFile` it and pass to `parseEpicsContent`.
  - [x] 2.2: Create `src/workspace/artifact-parser.test.ts` — test `parseEpicsContent()` only (pure, no I/O): (a) multi-epic content produces correct epicKeys (`"epic-1"`, `"epic-2"`) and storyKeys (`"1-1"`, `"1-2"`, `"2-1"`) in correct order, (b) empty string returns `[]`, (c) epic with no stories returns epic with empty storyKeys array, (d) story heading before any epic heading is ignored, (e) parses the epics.md format used in this project (use a representative sample).
  - [x] 2.3: Update `src/workspace/index.ts` — add `export { parseEpicsFromArtifacts } from './artifact-parser.js'` and `export type { EpicEntry } from './artifact-parser.js'`

- [x] Task 3: Implement Pipeline (AC: #2, #3, #4, #5)
  - [x] 3.1: Create `src/orchestrator/pipeline.ts` — export interface `PipelineOptions { epicKey: string; storyKey: string; runner: AgentRunner; stateManager: StateManager; workspacePath: string; log: (msg: string) => void; logError: (msg: string) => void }`. Export `runStoryPipeline(opts: PipelineOptions): Promise<'completed' | 'failed'>`. Implementation: (1) call `stateManager.updateStory(epicKey, storyKey, { status: 'in-progress', attempts: 1 })` once at start, (2) iterate PHASES array in order: `[{ phase: 'storyCreation', config: storyCreatorConfig }, { phase: 'development', config: developerConfig }, { phase: 'codeReview', config: codeReviewerConfig }, { phase: 'qa', config: qaConfig }]`, (3) for each phase: update `phase` in state, log dispatch message, load systemPrompt via `readFile(config.promptPath, 'utf-8')` then `.replaceAll('{{workspacePath}}', workspacePath).replaceAll('{epic}-{story}', storyKey)`, dispatch `runner.run({ model: config.model, systemPrompt, allowedTools: config.allowedTools, workspacePath, prompt: buildPhasePrompt(phase, epicKey, storyKey) })`, update story cost as cumulative sum, (4) if `!result.success` → logError, update state `{ status: 'failed', phase }`, return `'failed'`, (5) for codeReview success: read `join(workspacePath, 'stories', storyKey, 'review.md')` with `.catch(() => result.output)`, if content includes `'CHANGES REQUESTED'` → logError + update state `{ status: 'failed', phase: 'codeReview' }` + return `'failed'`, (6) after all phases pass: `updateStory({ status: 'completed', phase: 'completed' })`, log completion, return `'completed'`.
  - [x] 3.2: Create `src/orchestrator/pipeline.test.ts` — use `vi.mock('node:fs/promises')` to mock `readFile`. Use `vi.fn()` for AgentRunner.run, StateManager.updateStory. Test cases: (a) 4 phases all succeed → returns `'completed'`, updateStory called with `{ status: 'completed', phase: 'completed' }` at end, (b) storyCreation agent fails → returns `'failed'`, updateStory called with `{ status: 'failed' }`, remaining phases NOT dispatched, (c) CHANGES REQUESTED in review.md after codeReview success → returns `'failed'`, state set to failed, qa phase NOT dispatched, (d) APPROVED in review.md → qa phase IS dispatched, returns `'completed'`, (e) log called once per phase dispatch; logError NOT called on success.

- [x] Task 4: Implement Dispatcher (AC: #2, #3, #6)
  - [x] 4.1: Create `src/orchestrator/dispatcher.ts` — export interfaces `DispatcherOptions { runner: AgentRunner; stateManager: StateManager; workspacePath: string; log: (msg: string) => void; logError: (msg: string) => void }` and `DispatcherResult { completedCount: number; failedCount: number }`. Export `runDispatcher(opts: DispatcherOptions): Promise<DispatcherResult>`. Implementation: initialize `completedCount = 0, failedCount = 0`. Loop: call `stateManager.getStoriesByStatus('pending')`. If array is empty → break. Take `pending[0]` to get `{ epicKey, storyKey }`. Call `runStoryPipeline({ epicKey, storyKey, runner, stateManager, workspacePath, log, logError })`. If `'completed'` → `completedCount++`; if `'failed'` → `failedCount++`. Return `{ completedCount, failedCount }`.
  - [x] 4.2: Create `src/orchestrator/dispatcher.test.ts` — mock `runStoryPipeline` from `'./pipeline.js'` using `vi.hoisted` + `vi.mock`. Mock `stateManager.getStoriesByStatus` as `vi.fn()`. Tests: (a) empty pending returns `{ completedCount: 0, failedCount: 0 }`, never calls pipeline, (b) 1 pending story completes → `{ completedCount: 1, failedCount: 0 }`, (c) 1 pending story fails → `{ completedCount: 0, failedCount: 1 }`, (d) 3 stories (2 complete, 1 fail) — `getStoriesByStatus` returns decreasing array each call — `{ completedCount: 2, failedCount: 1 }`, (e) pipeline called with correct epicKey and storyKey from getStoriesByStatus result.

- [x] Task 5: Wire build command and update index files (AC: #1, #6)
  - [x] 5.1: Update `src/cli/build-command.ts` — replace placeholder action body with full implementation: (1) `const workspacePath = resolve(effective.workspacePath)`, `const artifactsPath = resolve(effective.artifactsPath)`, (2) create `WorkspaceManager`, call `initialize()`, (3) call `validateArtifacts(artifactsPath)`, if `!valid` → `logError(missing...)` + `process.exit(2)`, (4) `ingestArtifacts(artifactsPath)`, (5) `parseEpicsFromArtifacts(workspaceManager.artifactsPath)`, (6) create `StateManager`, call `initialize(epics, { defaultModel: effective.models.default, maxRetries: effective.retry.maxAttempts })`, (7) `runDispatcher({ runner: new ClaudeAgentRunner(), stateManager, workspacePath, log, logError })`, (8) `const exitCode = computeExitCode(result.completedCount, result.failedCount)`, (9) `await stateManager.updateRun({ status: exitCode === 0 ? 'completed' : exitCode === 1 ? 'partial' : 'failed' })`, (10) `process.exit(exitCode)`. Also remove the `// TODO (Epic 3): ...` comment from `src/index.ts`.
  - [x] 5.2: Update `src/orchestrator/index.ts` — replace `export {}` with exports for `runDispatcher`, `DispatcherOptions`, `DispatcherResult` from `'./dispatcher.js'` and `runStoryPipeline`, `PipelineOptions` from `'./pipeline.js'`
  - [x] 5.3: Update `src/cli/build-command.test.ts` — add `vi.mock` stubs for all new dependencies imported by the updated build-command.ts (`@/workspace/index.js` exporting mock WorkspaceManager class + parseEpicsFromArtifacts, `@/orchestrator/dispatcher.js` exporting mock runDispatcher, `@/agents/index.js` exporting mock ClaudeAgentRunner, `@/output/logger.js` exporting mock log/logError, `@/errors/agent-error.js` exporting mock computeExitCode). Add `vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)` in `beforeEach` to prevent process termination. Add new tests: (a) failed artifact validation calls `process.exit(2)`, (b) successful build (dispatcher returns `{ completedCount: 1, failedCount: 0 }`) calls `process.exit(0)`, (c) partial build calls `process.exit(1)`.

- [x] Task 6: Run tests and verify (AC: #1–#6)
  - [x] 6.1: Run `npm test` — confirm all 135 pre-existing tests plus new tests pass with no regressions. Report new test count and total.

## Dev Notes

### Architecture Overview

This story wires together all the modules built in Epics 1–3 into a working build pipeline. The data flow is:

```
build command action
  → WorkspaceManager.validateArtifacts()     (already implemented)
  → WorkspaceManager.ingestArtifacts()       (already implemented)
  → parseEpicsFromArtifacts()                (NEW: artifact-parser.ts)
  → StateManager.initialize()               (already implemented)
  → runDispatcher()                         (NEW: dispatcher.ts)
      → StateManager.getStoriesByStatus('pending')
      → runStoryPipeline()                  (NEW: pipeline.ts)
          → stateManager.updateStory(...)
          → readFile(config.promptPath) + substitution
          → runner.run(AgentConfig)
          → [for codeReview] readFile(review.md)
      → loop until no pending stories remain
  → stateManager.updateRun({ status })
  → process.exit(exitCode)
```

### New Files to Create

```
src/output/logger.ts
src/output/logger.test.ts
src/workspace/artifact-parser.ts
src/workspace/artifact-parser.test.ts
src/orchestrator/pipeline.ts
src/orchestrator/pipeline.test.ts
src/orchestrator/dispatcher.ts
src/orchestrator/dispatcher.test.ts
```

### Files to Modify

```
src/output/index.ts             (stub → export logger)
src/workspace/index.ts          (add artifact-parser exports)
src/orchestrator/index.ts       (stub → export dispatcher + pipeline)
src/cli/build-command.ts        (placeholder → full implementation)
src/cli/build-command.test.ts   (add mocks for new deps + new test cases)
src/index.ts                    (remove stale TODO comment)
```

### Files NOT to Touch

- `src/agents/**` — all agent configs and prompt.md files done in 3.2/3.3
- `src/workspace/state-manager.ts` — fully implemented in 2.3
- `src/workspace/workspace-manager.ts` — fully implemented in 2.2
- `src/errors/**` — fully implemented in 1.3
- `src/config/**` — fully implemented in 1.2

### Logger Implementation

```typescript
// src/output/logger.ts
function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

export function log(message: string): void {
  process.stdout.write(`[${timestamp()}] ${message}\n`)
}

export function logError(message: string): void {
  process.stderr.write(`[${timestamp()}] ERROR: ${message}\n`)
}
```

`toLocaleTimeString('en-US', { hour12: false })` produces `HH:MM:SS` format on Node.js 20+.
Use `process.stdout.write` / `process.stderr.write` — NOT `console.log` / `console.error` (console methods add extra buffering and newlines).

### Artifact Parser: Parsing epics.md

The project's `docs/planning-artifacts/epics.md` uses:
- `## Epic N: Title` for epic headings (e.g., `## Epic 1: Project Foundation & Configuration`)
- `### Story N.M: Title` for story headings (e.g., `### Story 1.1: Project Scaffold & CLI Entry Point`)

Parser produces:
- `epicKey: "epic-1"` from `## Epic 1:`
- `storyKey: "1-1"` from `### Story 1.1:` (dots become dashes)

```typescript
// src/workspace/artifact-parser.ts
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface EpicEntry {
  epicKey: string
  storyKeys: string[]
}

export function parseEpicsContent(content: string): EpicEntry[] {
  const lines = content.split('\n')
  const epics: EpicEntry[] = []
  let current: EpicEntry | null = null

  for (const line of lines) {
    const epicMatch = line.match(/^## Epic (\d+):/)
    if (epicMatch) {
      if (current) epics.push(current)
      current = { epicKey: `epic-${epicMatch[1]}`, storyKeys: [] }
      continue
    }
    const storyMatch = line.match(/^### Story (\d+)\.(\d+):/)
    if (storyMatch && current) {
      current.storyKeys.push(`${storyMatch[1]}-${storyMatch[2]}`)
    }
  }
  if (current) epics.push(current)
  return epics
}

export async function parseEpicsFromArtifacts(artifactsPath: string): Promise<EpicEntry[]> {
  const files = await readdir(artifactsPath)
  const epicsFile = files.find(f => /(epic|stories).*\.md$/i.test(f))
  if (!epicsFile) throw new Error(`No epics/stories file found in: ${artifactsPath}`)
  const content = await readFile(join(artifactsPath, epicsFile), 'utf-8')
  return parseEpicsContent(content)
}
```

### Pipeline: Phase Array and Prompt Substitution

Import agent role configs directly from their module files (do NOT re-export them through `src/agents/index.ts`):

```typescript
import { storyCreatorConfig } from '@/agents/story-creator/config.js'
import { developerConfig } from '@/agents/developer/config.js'
import { codeReviewerConfig } from '@/agents/code-reviewer/config.js'
import { qaConfig } from '@/agents/qa/config.js'
```

The `prompt.md` files (confirmed in story 3.2/3.3) use `{{workspacePath}}` and `{epic}-{story}` as placeholders. Substitute both when loading system prompt:

```typescript
const rawPrompt = await readFile(config.promptPath, 'utf-8')
const systemPrompt = rawPrompt
  .replaceAll('{{workspacePath}}', workspacePath)
  .replaceAll('{epic}-{story}', storyKey)
```

The `prompt` field in `AgentConfig` (the user-turn task instruction):

```typescript
function buildPhasePrompt(phase: PipelinePhase, epicKey: string, storyKey: string): string {
  const actions: Record<PipelinePhase, string> = {
    storyCreation: 'create the story specification',
    development: 'implement the story',
    codeReview: 'review the implementation',
    qa: 'run tests and validate the implementation',
  }
  return `Process story ${storyKey} in epic ${epicKey}: ${actions[phase]}.`
}
```

### Pipeline: State Update Sequence

Per-phase updates (in order):
1. START of phase → `updateStory(epicKey, storyKey, { phase })`
2. END of phase (success) → `updateStory(epicKey, storyKey, { cost: cumulativeCost })`
3. END of story (all phases) → `updateStory(epicKey, storyKey, { status: 'completed', phase: 'completed' })`
4. FAILURE → `updateStory(epicKey, storyKey, { status: 'failed', phase, cost: cumulativeCost })`

Track cumulative cost across phases:
```typescript
let cumulativeCost = 0
// inside loop:
cumulativeCost += result.cost.totalCostUsd
await stateManager.updateStory(epicKey, storyKey, { cost: cumulativeCost })
```

### Pipeline: Code Review Rejection

The code-reviewer writes to `stories/{storyKey}/review.md` with either `APPROVED` or `CHANGES REQUESTED` as the verdict. After `codeReview` agent returns success, check the file:

```typescript
if (phase === 'codeReview' && result.success) {
  const reviewPath = join(workspacePath, 'stories', storyKey, 'review.md')
  const reviewContent = await readFile(reviewPath, 'utf-8').catch(() => result.output)
  if (reviewContent.includes('CHANGES REQUESTED')) {
    logError(`Code review requested changes for story ${epicKey}/${storyKey}`)
    await stateManager.updateStory(epicKey, storyKey, {
      status: 'failed',
      phase: 'codeReview',
      cost: cumulativeCost,
    })
    return 'failed'
  }
}
```

The review.md is left in place naturally — no deletion. It will be available as workspace context if the story is retried in Epic 4.

### AgentConfig Interface Reference

Already defined in `src/agents/types.ts`:
```typescript
export interface AgentConfig {
  model: string
  systemPrompt: string
  allowedTools: string[]
  workspacePath: string
  prompt: string
}
```

`systemPrompt` = loaded from prompt.md with placeholders substituted.
`prompt` = the per-invocation task instruction (user turn).
`workspacePath` = passed as-is to the SDK (agent's `cwd`).

### Build Command: Full Action Signature

Add these imports to `src/cli/build-command.ts`:

```typescript
import { resolve } from 'node:path'
import { WorkspaceManager, StateManager, parseEpicsFromArtifacts } from '@/workspace/index.js'
import { runDispatcher } from '@/orchestrator/dispatcher.js'
import { ClaudeAgentRunner } from '@/agents/index.js'
import { computeExitCode } from '@/errors/agent-error.js'
import { log, logError } from '@/output/logger.js'
```

The `effective.workspacePath` and `effective.artifactsPath` are relative paths from config/flags. Use `resolve()` to get absolute paths before passing to WorkspaceManager.

### Build Command Test: Mocking Strategy

The existing tests (lines 55–116) call `program.parseAsync` which triggers the action handler. After this story, the action handler does real work, so all new dependencies must be mocked.

Use `vi.hoisted` pattern (consistent with existing test file):

```typescript
const { mockWorkspaceManager, MockWorkspaceManager, mockRunDispatcher, MockClaudeAgentRunner, mockLog, mockLogError, mockComputeExitCode, mockParseEpicsFromArtifacts, mockStateManager, MockStateManager } = vi.hoisted(() => ({
  mockWorkspaceManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    validateArtifacts: vi.fn().mockResolvedValue({ valid: true, requiredFound: [], missingRequired: [], optionalFound: [] }),
    ingestArtifacts: vi.fn().mockResolvedValue(undefined),
    artifactsPath: '/mock/workspace/artifacts',
  },
  MockWorkspaceManager: vi.fn(),
  mockStateManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    updateRun: vi.fn().mockResolvedValue(undefined),
  },
  MockStateManager: vi.fn(),
  MockClaudeAgentRunner: vi.fn(),
  mockRunDispatcher: vi.fn().mockResolvedValue({ completedCount: 1, failedCount: 0 }),
  mockLog: vi.fn(),
  mockLogError: vi.fn(),
  mockComputeExitCode: vi.fn().mockReturnValue(0),
  mockParseEpicsFromArtifacts: vi.fn().mockResolvedValue([{ epicKey: 'epic-1', storyKeys: ['1-1'] }]),
}))
```

Add mocks:
```typescript
vi.mock('@/workspace/index.js', () => ({
  WorkspaceManager: MockWorkspaceManager,
  StateManager: MockStateManager,
  parseEpicsFromArtifacts: mockParseEpicsFromArtifacts,
}))
vi.mock('@/orchestrator/dispatcher.js', () => ({ runDispatcher: mockRunDispatcher }))
vi.mock('@/agents/index.js', () => ({ ClaudeAgentRunner: MockClaudeAgentRunner }))
vi.mock('@/output/logger.js', () => ({ log: mockLog, logError: mockLogError }))
vi.mock('@/errors/agent-error.js', () => ({ computeExitCode: mockComputeExitCode }))
```

In `beforeEach`:
```typescript
MockWorkspaceManager.mockImplementation(() => mockWorkspaceManager)
MockStateManager.mockImplementation(() => mockStateManager)
MockClaudeAgentRunner.mockImplementation(() => ({}))
vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
```

### Pipeline Test: Mocking readFile

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { runStoryPipeline } from './pipeline.js'

const { mockReadFile } = vi.hoisted(() => ({ mockReadFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }))

// Default: return empty string for prompts, 'APPROVED' for review.md
mockReadFile.mockImplementation((path: string) => {
  if (typeof path === 'string' && path.endsWith('review.md')) {
    return Promise.resolve('APPROVED\n\nAll criteria met.')
  }
  return Promise.resolve('mock system prompt content')
})
```

Mock AgentRunner and StateManager with `vi.fn()`:
```typescript
const mockRunner = { run: vi.fn().mockResolvedValue({ success: true, output: '', cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-sonnet-4-6' } }) }
const mockStateManager = { updateStory: vi.fn().mockResolvedValue(undefined) }
```

### Dispatcher Test: Mocking runStoryPipeline

```typescript
const { mockRunStoryPipeline } = vi.hoisted(() => ({ mockRunStoryPipeline: vi.fn() }))
vi.mock('./pipeline.js', () => ({ runStoryPipeline: mockRunStoryPipeline }))

// Simulate decreasing pending list across calls for multi-story tests:
let callCount = 0
const stories = [
  { epicKey: 'epic-1', storyKey: '1-1', status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
  { epicKey: 'epic-1', storyKey: '1-2', status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
]
mockGetStoriesByStatus.mockImplementation(() => {
  return Promise.resolve(stories.slice(callCount++))  // gets shorter each call
})
```

### Previous Story Intelligence (Story 3.3)

**135 tests currently passing** — verify no regressions after all changes.

**Patterns confirmed in 3.3 to continue exactly:**
- ESM `__dirname` equivalent: `dirname(fileURLToPath(import.meta.url))` — mandatory
- `node:` prefix for all Node.js built-in imports: `node:fs/promises`, `node:path`
- Relative imports within a module directory use `.js` extension: `from './pipeline.js'`
- Cross-module imports use `@/` aliases: `import { StateManager } from '@/workspace/index.js'`
- `import type` for type-only imports
- `prompt.md` files use `{{workspacePath}}` placeholder — Story 3.4 substitutes the actual path
- Story 3.4 also substitutes `{epic}-{story}` with actual story key in system prompt
- `vi.hoisted()` pattern used in this project's test files for mock setup
- DO NOT touch the pre-existing typecheck error in `src/agents/claude-agent-runner.test.ts:34`

**Current `src/agents/index.ts` barrel** (do NOT add more to it):
```typescript
export type { AgentRunner } from './agent-runner.js'
export { ClaudeAgentRunner } from './claude-agent-runner.js'
export type { AgentConfig, AgentResult, AgentCostData, AgentRoleConfig } from './types.js'
```

**`tsup.config.ts`** already has `onSuccess` hook copying all `.md` files from `src/` to `dist/` — prompt.md files are included in build output automatically.

### Existing AgentConfig Type (Already Defined — Do NOT Redefine)

```typescript
// src/agents/types.ts
export interface AgentConfig {
  model: string
  systemPrompt: string    // loaded from prompt.md with placeholders substituted
  allowedTools: string[]
  workspacePath: string
  prompt: string          // per-invocation user-turn instruction
}
```

### RunStatus Mapping for Build Command

```typescript
// exitCode from computeExitCode(completedCount, failedCount):
// 0 → all completed → runStatus: 'completed'
// 1 → partial success → runStatus: 'partial'
// 2 → all failed → runStatus: 'failed'
const runStatus: RunStatus = exitCode === 0 ? 'completed' : exitCode === 1 ? 'partial' : 'failed'
```

`RunStatus` is exported from `@/workspace/index.js`.

### Anti-Patterns to Avoid

- **DO NOT** call `runner.run()` in the dispatcher — only the pipeline knows about agent phases and configs
- **DO NOT** use `string.replace()` — use `.replaceAll()` for placeholder substitution (a single `replace` only replaces the first occurrence)
- **DO NOT** hardcode `.startup-factory/` anywhere — always use the `workspacePath` parameter
- **DO NOT** add agent role configs (storyCreatorConfig, developerConfig, etc.) to `src/agents/index.ts` barrel — import them directly: `import { storyCreatorConfig } from '@/agents/story-creator/config.js'`
- **DO NOT** use `console.log` in logger — use `process.stdout.write` for predictable output
- **DO NOT** call `process.exit()` in test files — mock it with `vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)`
- **DO NOT** update epic status in the dispatcher — `StateManager` has no `updateEpic` method; epic status management is deferred to Epic 4
- **DO NOT** add a `buildPhasePrompt` helper to any file other than pipeline.ts — it is internal to pipeline
- **DO NOT** import `StoryPhase` from `@/workspace/index.js` and redefine the pipeline phases — `PipelinePhase` is just the subset of phases the pipeline uses
- **DO NOT** skip `stateManager.updateStory({ status: 'in-progress', attempts: 1 })` at the start of `runStoryPipeline` — it marks the story as in-progress before any agent dispatch

### Project Structure Notes

New files align with architecture spec (`docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure`):
- `src/output/logger.ts` — listed as `FR39: Structured log lines to stdout`
- `src/orchestrator/dispatcher.ts` — listed as `FR3, FR6: Sequential agent dispatch loop`
- `src/orchestrator/pipeline.ts` — listed as `FR3: Story Creator → Dev → Review → QA`
- `src/workspace/artifact-parser.ts` — needed by build command to parse epics.md for state init (implied by FR1/FR2)

The architecture diagram shows `dispatcher.ts` and `pipeline.ts` as separate files — keep this separation. The dispatcher is the loop; the pipeline is the per-story phase sequence.

### References

- [Source: docs/planning-artifacts/epics.md#Story-3.4] — Exact AC text for all 6 ACs
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — Confirmed file paths: dispatcher.ts, pipeline.ts, logger.ts
- [Source: docs/planning-artifacts/architecture.md#Data-Flow] — Full orchestration sequence
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns] — kebab-case, async/await, @/ aliases, .js extensions, function DI
- [Source: docs/planning-artifacts/architecture.md#Error-Handling-&-Logging] — Human-readable default format `[22:01:03] Starting story 1-1 with developer agent`
- [Source: docs/implementation-artifacts/3-3-code-reviewer-qa-agent-configurations.md#Completion-Notes-List] — 135 tests passing; `{{workspacePath}}` placeholder; story 3.4 substitutes it; pre-existing typecheck error in claude-agent-runner.test.ts not to touch
- [Source: docs/implementation-artifacts/3-3-code-reviewer-qa-agent-configurations.md#Dev-Notes] — Agent tool lists, promptPath pattern, review.md verdict format (APPROVED / CHANGES REQUESTED)
- [Source: src/agents/types.ts] — AgentConfig interface with `systemPrompt`, `prompt`, `workspacePath` fields
- [Source: src/workspace/types.ts] — StoryPhase, StoryStatus, RunStatus enums
- [Source: src/workspace/state-manager.ts] — StateManager.updateStory, updateRun, getStoriesByStatus signatures
- [Source: src/errors/agent-error.ts] — computeExitCode(completedCount, failedCount) → 0 | 1 | 2
- [Source: src/index.ts:8] — TODO comment to remove when build command implements exit codes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Fixed `MockWorkspaceManager.mockImplementation` in build-command.test.ts: used regular function `function() { return mockWorkspaceManager }` instead of arrow function. Arrow functions can't be called with `new` in vitest 4.x.

### Completion Notes List

- Implemented `src/output/logger.ts` with `log()` → stdout and `logError()` → stderr using `process.stdout.write`/`process.stderr.write` with `[HH:MM:SS]` timestamp format.
- Implemented `src/workspace/artifact-parser.ts` with pure `parseEpicsContent()` and async `parseEpicsFromArtifacts()` to parse epics.md format.
- Implemented `src/orchestrator/pipeline.ts` with `runStoryPipeline()` dispatching 4 phases sequentially, handling code-review rejection via `review.md` content check.
- Implemented `src/orchestrator/dispatcher.ts` with `runDispatcher()` looping over pending stories until none remain.
- Wired full build command in `src/cli/build-command.ts` replacing placeholder with complete orchestration flow.
- Updated index barrel files: `src/output/index.ts`, `src/workspace/index.ts`, `src/orchestrator/index.ts`.
- Removed stale TODO comment from `src/index.ts`.
- All 157 tests pass: 135 pre-existing + 22 new (4 logger, 5 artifact-parser, 5 pipeline, 5 dispatcher, 3 new build-command).

### File List

- src/output/logger.ts (new)
- src/output/logger.test.ts (new)
- src/output/index.ts (modified)
- src/workspace/artifact-parser.ts (new)
- src/workspace/artifact-parser.test.ts (new)
- src/workspace/index.ts (modified)
- src/orchestrator/pipeline.ts (new)
- src/orchestrator/pipeline.test.ts (new)
- src/orchestrator/dispatcher.ts (new)
- src/orchestrator/dispatcher.test.ts (new)
- src/orchestrator/index.ts (modified)
- src/cli/build-command.ts (modified)
- src/cli/build-command.test.ts (modified)
- src/index.ts (modified)

## Change Log

- 2026-03-06: Implemented story 3-4 — Logger, Artifact Parser, Pipeline, Dispatcher, Build Command wiring. 22 new tests added, total 157 passing.
- 2026-03-06: Code review fixes — Added "story started" log in dispatcher; added "phase completed" log per pipeline phase (AC4 full compliance); fixed double updateStory write on failure path to single atomic update (M1); added parseEpicsFromArtifacts async tests including error path (M3). 2 new tests, total 159 passing.
