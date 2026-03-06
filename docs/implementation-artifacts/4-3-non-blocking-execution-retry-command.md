# Story 4.3: Non-Blocking Execution & Retry Command

Status: done

## Story

As an operator,
I want the pipeline to skip blocked stories and continue with others, and I want to selectively retry failed stories later,
So that one failure doesn't block the entire build and I can address failures incrementally.

## Acceptance Criteria

1. **Given** a story fails and is flagged for human attention
   **When** the dispatcher looks for the next story to process
   **Then** it skips the failed story and continues with the next pending story that doesn't collide with the failed one

2. **Given** a completed build with some failed stories
   **When** the operator runs `startup-factory retry <story-id>`
   **Then** the system loads the existing state file, resets the specified story to pending, and re-runs it through the pipeline from the failed phase
   **And** previous failure notes are preserved and available to the retried agent

3. **Given** an operator retries a story that doesn't exist in the state file
   **When** the retry command executes
   **Then** it fails with a clear error identifying that the story ID was not found

4. **Given** an operator retries a story that is already completed
   **When** the retry command executes
   **Then** it warns the operator that the story already completed and exits without action

## Tasks / Subtasks

- [x] Task 1: Fix `build-command.ts` missing `appConfig` and verify non-blocking dispatcher (AC: #1)
  - [x] 1.1: In `src/cli/build-command.ts`, add `appConfig: effective` to the `runDispatcher(...)` call. The `DispatcherOptions` interface requires it but the current build command omits it (TypeScript type error). This is a bug from story 4-2 that must be fixed here.
  - [x] 1.2: Add a test in `src/orchestrator/dispatcher.test.ts` verifying that when one story fails (`runStoryPipeline` resolves `'failed'`), the dispatcher continues processing the remaining pending stories (does not stop after the first failure). The existing test for `{ completedCount: 2, failedCount: 1 }` may already cover this, but add a focused AC1 test: a failed story is skipped and the next pending story is dispatched.

- [x] Task 2: Add `getStoryByKey` to `StateManager` (AC: #2, #3, #4)
  - [x] 2.1: Add method `getStoryByKey(storyKey: string): Promise<{ epicKey: string; storyKey: string } & StoryState | null>` to `src/workspace/state-manager.ts`. It searches all epics for a story matching `storyKey` and returns the story + its epicKey, or `null` if not found. Export via `src/workspace/index.ts`.
  - [x] 2.2: Add tests for `getStoryByKey` in `src/workspace/state-manager.test.ts`:
    - Returns `null` when story key does not exist in any epic
    - Returns correct `{ epicKey, storyKey, ...StoryState }` when story exists
    - Returns correct result after `updateStory()` changes story state

- [x] Task 3: Add optional `startPhase` to `runStoryPipeline` (AC: #2)
  - [x] 3.1: Add `startPhase?: PipelinePhase` to `PipelineOptions` in `src/orchestrator/pipeline.ts`. When `startPhase` is set, skip all PHASES before it in the loop (use `Array.findIndex` to locate the start index, then `PHASES.slice(startIndex)` to iterate only from that phase onward). When `startPhase` is `undefined` or not in PHASES, run all phases as normal (full pipeline).
  - [x] 3.2: Add tests to `src/orchestrator/pipeline.test.ts`:
    - When `startPhase: 'development'` is passed, storyCreation agent is NOT dispatched and development agent IS dispatched first
    - When `startPhase: 'codeReview'` is passed, only codeReview and qa agents are dispatched
    - When `startPhase` is undefined (default), all 4 phases run as usual (existing tests should still pass)

- [x] Task 4: Implement retry command action (AC: #2, #3, #4)
  - [x] 4.1: Replace the stub action in `src/cli/retry-command.ts` with the full implementation:
    - Resolve `workspacePath` from effective config using `resolve(effective.workspacePath)`
    - Construct `StateManager` from `workspacePath`
    - Call `stateManager.getStoryByKey(storyId)` to find the story
    - If `null`: call `logError(...)` and `process.exit(2)` with message `Story not found in state: ${storyId}`
    - If `status === 'completed'`: log warning `Story ${storyId} is already completed. Nothing to retry.` and `process.exit(0)`
    - If `status === 'in-progress'`: log warning and exit (treat same as completed — don't retry in-progress)
    - Otherwise (failed or pending): extract the story's current `phase` as the `startPhase`, reset story to `{ status: 'pending', phase: 'pending', attempts: 0 }` via `updateStory`, then call `runStoryPipeline({ epicKey, storyKey, runner: new ClaudeAgentRunner(), stateManager, workspacePath, appConfig: effective, startPhase: failedPhase, log, logError })`
    - After pipeline completes, call `process.exit(computeExitCode(outcome === 'completed' ? 1 : 0, outcome === 'failed' ? 1 : 0))`
  - [x] 4.2: Add required imports to `retry-command.ts`: `resolve` from `node:path`; `StateManager` from `@/workspace/index.js`; `runStoryPipeline` from `@/orchestrator/dispatcher.js` (NO — use `runStoryPipeline` from `@/orchestrator/index.js`); `ClaudeAgentRunner` from `@/agents/index.js`; `computeExitCode` from `@/errors/agent-error.js`; `log`, `logError` from `@/output/logger.js`; `StoryPhase` type from `@/workspace/index.js`

- [x] Task 5: Update retry-command tests and run full suite (AC: all)
  - [x] 5.1: Expand `src/cli/retry-command.test.ts` with functional tests using mocks for `StateManager`, `runStoryPipeline`, `ClaudeAgentRunner`, `computeExitCode`:
    - When `getStoryByKey` returns `null` → `logError` called with "not found" message and `process.exit(2)` called
    - When story status is `'completed'` → warning logged and `process.exit(0)` called
    - When story status is `'failed'` → `updateStory` called to reset, `runStoryPipeline` called with correct `startPhase` (the story's failed `phase`)
    - `runStoryPipeline` receives `appConfig`, `workspacePath`, `epicKey`, `storyKey` from state lookup
    - `startPhase` passed to `runStoryPipeline` matches the story's `phase` at time of retry
  - [x] 5.2: Run `npm test` — confirm all pre-existing tests plus new tests pass with zero regressions. Report total test count and new test count.

## Dev Notes

### Architecture Placement

Per `docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure`:
- **Modify:** `src/cli/build-command.ts` — fix missing `appConfig` in `runDispatcher` call
- **Modify:** `src/cli/retry-command.ts` — implement full retry logic (currently a stub)
- **Modify:** `src/cli/retry-command.test.ts` — expand stub tests with functional coverage
- **Modify:** `src/workspace/state-manager.ts` — add `getStoryByKey` method
- **Modify:** `src/workspace/state-manager.test.ts` — add tests for `getStoryByKey`
- **Modify:** `src/workspace/index.ts` — export `getStoryByKey` if needed (it's a method, so no barrel change needed)
- **Modify:** `src/orchestrator/pipeline.ts` — add optional `startPhase` to `PipelineOptions`
- **Modify:** `src/orchestrator/pipeline.test.ts` — add `startPhase` tests

### Bug: Missing `appConfig` in `build-command.ts`

**Critical bug introduced in story 4-2.** The `DispatcherOptions` interface requires `appConfig: AppConfig`, but `build-command.ts` calls `runDispatcher` without it:

```typescript
// CURRENT (BROKEN):
const result = await runDispatcher({
  runner: new ClaudeAgentRunner(),
  stateManager,
  workspacePath,
  log,
  logError,
  // appConfig is MISSING → TypeScript error + runtime crash
})

// FIXED:
const result = await runDispatcher({
  runner: new ClaudeAgentRunner(),
  stateManager,
  workspacePath,
  appConfig: effective,  // ADD THIS
  log,
  logError,
})
```

### Non-Blocking Dispatcher (AC1)

The dispatcher already handles AC1 naturally. It only queries `getStoriesByStatus('pending')`. When a story fails (status → `'failed'`), it is excluded from future `pending` queries. The loop terminates only when no pending stories remain:

```typescript
while (true) {
  const pending = await stateManager.getStoriesByStatus('pending')
  if (pending.length === 0) break  // stops only when all stories are processed
  const { epicKey, storyKey } = pending[0]
  // ... run story
}
```

No changes to dispatcher logic are needed for AC1. The task is to fix `build-command.ts` (which would crash before the dispatcher even runs) and add a test confirming the behavior.

### `getStoryByKey` Implementation

Add to `StateManager` in `src/workspace/state-manager.ts`:

```typescript
async getStoryByKey(
  storyKey: string,
): Promise<({ epicKey: string; storyKey: string } & StoryState) | null> {
  const state = await this.read()
  for (const [epicKey, epic] of Object.entries(state.epics)) {
    const story = epic.stories[storyKey]
    if (story) {
      return { epicKey, storyKey, ...story }
    }
  }
  return null
}
```

No changes to `src/workspace/index.ts` needed — `getStoryByKey` is a method on `StateManager`, which is already exported.

### `startPhase` in `PipelineOptions` and `runStoryPipeline`

**Updated `PipelineOptions`:**
```typescript
export interface PipelineOptions {
  epicKey: string
  storyKey: string
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  appConfig: AppConfig
  startPhase?: PipelinePhase  // NEW: optional, defaults to undefined (run all)
  log: (msg: string) => void
  logError: (msg: string) => void
}
```

**Updated phase loop:**
```typescript
const startIndex = opts.startPhase
  ? PHASES.findIndex(p => p.phase === opts.startPhase)
  : 0
const activePhases = startIndex >= 0 ? PHASES.slice(startIndex) : PHASES

for (const { phase, config } of activePhases) {
  // ... existing loop body unchanged
}
```

**Note:** If `startPhase` is an unknown value not in PHASES (e.g., `'completed'` or `'failed'`), `findIndex` returns `-1`. In that case, fall back to running all phases (`startIndex >= 0` check handles this).

**Note on initial `stateManager.updateStory` call:** The pipeline opens with:
```typescript
await stateManager.updateStory(epicKey, storyKey, { status: 'in-progress', attempts: 1 })
```
This is fine for retry too — it marks the story as in-progress when re-running.

### Retry Command Full Implementation

```typescript
// src/cli/retry-command.ts
import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig, mergeCliFlags } from '@/config/index.js'
import { StateManager } from '@/workspace/index.js'
import type { StoryPhase } from '@/workspace/index.js'
import { runStoryPipeline } from '@/orchestrator/index.js'
import { ClaudeAgentRunner } from '@/agents/index.js'
import { computeExitCode } from '@/errors/agent-error.js'
import { log, logError } from '@/output/logger.js'

export function registerRetryCommand(program: Command): void {
  program
    .command('retry <story-id>')
    .description('Retry a failed story')
    .option('--max-retries <n>', 'Maximum retry attempts', (s) => parseInt(s, 10))
    .option('--model <model>', 'Default model to use')
    .option('--config <path>', 'Path to config file')
    .action(async (storyId, options) => {
      const config = await loadConfig(options.config)
      const effective = mergeCliFlags(config, {
        maxRetries: options.maxRetries,
        model: options.model,
      })

      const workspacePath = resolve(effective.workspacePath)
      const stateManager = new StateManager(workspacePath)

      const storyEntry = await stateManager.getStoryByKey(storyId)

      if (!storyEntry) {
        logError(`Story not found in state: ${storyId}`)
        process.exit(2)
      }

      if (storyEntry.status === 'completed') {
        log(`Story ${storyId} is already completed. Nothing to retry.`)
        process.exit(0)
      }

      if (storyEntry.status === 'in-progress') {
        log(`Story ${storyId} is currently in-progress. Nothing to retry.`)
        process.exit(0)
      }

      // Determine start phase from story's recorded failed phase
      // Phases that can be retried: storyCreation, development, codeReview, qa
      // If phase is 'pending' or 'failed' (edge case), start from beginning
      const retryablePhases: StoryPhase[] = ['storyCreation', 'development', 'codeReview', 'qa']
      const startPhase = retryablePhases.includes(storyEntry.phase)
        ? (storyEntry.phase as 'storyCreation' | 'development' | 'codeReview' | 'qa')
        : undefined

      // Reset story to pending — preserve cost/failure history in files, reset status
      await stateManager.updateStory(storyEntry.epicKey, storyId, {
        status: 'pending',
        phase: 'pending',
        attempts: 0,
      })

      log(`Retrying story ${storyId} from phase: ${startPhase ?? 'storyCreation (beginning)'}`)

      const outcome = await runStoryPipeline({
        epicKey: storyEntry.epicKey,
        storyKey: storyId,
        runner: new ClaudeAgentRunner(),
        stateManager,
        workspacePath,
        appConfig: effective,
        startPhase,
        log,
        logError,
      })

      const exitCode = computeExitCode(
        outcome === 'completed' ? 1 : 0,
        outcome === 'failed' ? 1 : 0,
      )
      process.exit(exitCode)
    })
}
```

**Important note on `startPhase` type:** The `startPhase` field in `PipelineOptions` should be typed as `PipelinePhase | undefined`. In the pipeline code, `PipelinePhase` is defined as `type PipelinePhase = 'storyCreation' | 'development' | 'codeReview' | 'qa'` (internal to pipeline.ts). But `StoryPhase` from workspace/types.ts is broader (includes `'pending'`, `'completed'`, `'failed'`). The `PipelinePhase` type should be exported from `pipeline.ts` and re-exported from `src/orchestrator/index.ts` so `retry-command.ts` can use it for the `startPhase` parameter.

### `computeExitCode` Signature

From `src/errors/agent-error.ts` (verify before use):
```typescript
export function computeExitCode(completedCount: number, failedCount: number): number
// Returns: 0 if failedCount === 0, 1 if both > 0, 2 if completedCount === 0
```

For retry of a single story:
- Completed → `computeExitCode(1, 0)` → exit 0
- Failed → `computeExitCode(0, 1)` → exit 2

### Previous Story Learnings (from 4-2)

- **`node:` prefix** for all Node.js built-in imports (`import { resolve } from 'node:path'`)
- **`.js` extension** on all relative imports within same directory
- **`@/` aliases** for all cross-module imports
- **`import type`** for type-only imports (`import type { StoryPhase } from '@/workspace/index.js'`)
- **`async/await`** everywhere — no `.then().catch()` chains
- **camelCase** function names, **PascalCase** type names
- **kebab-case** file names
- Test mocking pattern: `vi.hoisted()` + `vi.mock()` at module level (see dispatcher.test.ts and retry-command.test.ts)
- StateManager tests use real tmp dirs (`mkdtemp` + `rm` in beforeEach/afterEach)
- Pipeline tests mock `runner.run()` with `vi.fn()` pattern

### `PipelinePhase` Export

Currently `PipelinePhase` is defined as an internal type in `pipeline.ts`. The retry command needs it for `startPhase`. **Export it:**

In `src/orchestrator/pipeline.ts`:
```typescript
export type PipelinePhase = 'storyCreation' | 'development' | 'codeReview' | 'qa'
```

In `src/orchestrator/index.ts`, add:
```typescript
export type { PipelinePhase } from './pipeline.js'
```

### Files to Modify

- `src/cli/build-command.ts` — fix: add `appConfig: effective` to `runDispatcher` call
- `src/cli/retry-command.ts` — implement full retry logic
- `src/cli/retry-command.test.ts` — expand with functional tests
- `src/workspace/state-manager.ts` — add `getStoryByKey` method
- `src/workspace/state-manager.test.ts` — add tests for `getStoryByKey`
- `src/orchestrator/pipeline.ts` — add optional `startPhase` to `PipelineOptions`; export `PipelinePhase`
- `src/orchestrator/pipeline.test.ts` — add `startPhase` tests
- `src/orchestrator/index.ts` — export `PipelinePhase`
- `src/orchestrator/dispatcher.test.ts` — add AC1 test (dispatcher continues after story failure)

### Files NOT to Touch

- `src/orchestrator/dispatcher.ts` — dispatcher logic is correct; no changes needed
- `src/orchestrator/escalation.ts` — complete, no changes
- `src/workspace/failure-notes.ts` — complete; failure notes are preserved on retry (not deleted)
- `src/workspace/types.ts` — types complete; no changes needed
- `src/workspace/workspace-manager.ts` — no changes needed
- `src/errors/agent-error.ts` — complete; no changes needed
- `src/agents/**` — no agent config changes
- `src/config/**` — no config changes

### Test Patterns to Follow

**For `dispatcher.test.ts` AC1 test:**
```typescript
it('continues to next pending story after a failed story (non-blocking)', async () => {
  mockStateManager.getStoriesByStatus
    .mockResolvedValueOnce([makeStory('epic-1', '1-1'), makeStory('epic-1', '1-2')])
    .mockResolvedValueOnce([makeStory('epic-1', '1-2')])  // 1-1 failed, 1-2 still pending
    .mockResolvedValueOnce([])
  mockRunStoryPipeline
    .mockResolvedValueOnce('failed')   // 1-1 fails
    .mockResolvedValueOnce('completed') // 1-2 succeeds
  const result = await runDispatcher(baseOpts)
  expect(result).toEqual({ completedCount: 1, failedCount: 1 })
  expect(mockRunStoryPipeline).toHaveBeenCalledTimes(2)
})
```

**For `retry-command.test.ts` functional tests:**
```typescript
// Mock pattern - add to existing vi.hoisted block:
const { mockGetStoryByKey, mockRunStoryPipeline, mockUpdateStory } = vi.hoisted(() => ({...}))
vi.mock('@/workspace/index.js', () => ({ StateManager: vi.fn().mockImplementation(() => ({
  getStoryByKey: mockGetStoryByKey,
  updateStory: mockUpdateStory,
})) }))
vi.mock('@/orchestrator/index.js', () => ({ runStoryPipeline: mockRunStoryPipeline }))
vi.mock('@/agents/index.js', () => ({ ClaudeAgentRunner: vi.fn() }))
vi.mock('node:process', ...)  // OR spy on process.exit
```

**For `pipeline.test.ts` `startPhase` tests:**
```typescript
it('skips phases before startPhase when startPhase is set', async () => {
  // Setup: mock runner to succeed for all phases
  // Call runStoryPipeline with startPhase: 'development'
  // Assert: runner.run was NOT called for 'storyCreation'
  // Assert: runner.run WAS called for 'development'
})
```

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.3] — All 4 ACs (FR4, FR12, FR36)
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — File paths
- [Source: src/orchestrator/dispatcher.ts] — Current dispatcher (already non-blocking via pending-only query)
- [Source: src/orchestrator/pipeline.ts] — Pipeline implementation; add `startPhase` here
- [Source: src/cli/build-command.ts] — Missing `appConfig` bug to fix
- [Source: src/cli/retry-command.ts] — Current stub to replace with full implementation
- [Source: src/workspace/state-manager.ts] — Add `getStoryByKey` method
- [Source: src/workspace/types.ts] — `StoryPhase` type, `StoryState` interface
- [Source: docs/implementation-artifacts/4-2-three-tier-escalation-logic.md#Completion-Notes-List] — 192 tests passing; confirm no regressions
- [Source: docs/implementation-artifacts/4-2-three-tier-escalation-logic.md#Dev-Notes] — Import patterns, test patterns to follow exactly

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Fixed bug in `build-command.ts`: missing `appConfig: effective` in `runDispatcher` call (would cause TypeScript error + runtime crash)
- Added `StateManager.getStoryByKey()` method that searches all epics for a story by key, returning the story + epicKey or null
- Added `startPhase?: PipelinePhase` to `PipelineOptions` and updated phase loop in `runStoryPipeline` to begin from the specified phase (with fallback to all phases if unknown/undefined)
- Exported `PipelinePhase` type from `src/orchestrator/pipeline.ts` and re-exported from `src/orchestrator/index.ts`
- Implemented full retry command: state lookup, completion guard, reset to pending, pipeline re-run from failed phase
- All 206 tests pass (14 new tests added); 0 regressions
- **Code review fixes (6 additional tests, 212 total):**
  - Fixed EEXIST crash: `writeFailureNote` now computes next available attempt number via `readdir` to avoid collision with existing notes from prior run (H1)
  - Fixed AC2 violation: `forceLoadNotes` initialized to `true` when `startPhase` is set, so retried agent sees prior failure notes on its first attempt (H2)
  - Added try/catch in retry command around `runStoryPipeline` to catch system errors with clean logError + exit(2) (M1)
  - Added tests: in-progress guard, storyCreation/qa as startPhase, system error handling, retry EEXIST safety, pipeline notes-on-retry (M2/M3)

### File List

- src/cli/build-command.ts
- src/cli/retry-command.ts
- src/cli/retry-command.test.ts
- src/workspace/state-manager.ts
- src/workspace/state-manager.test.ts
- src/workspace/failure-notes.ts
- src/workspace/failure-notes.test.ts
- src/orchestrator/pipeline.ts
- src/orchestrator/pipeline.test.ts
- src/orchestrator/index.ts
- src/orchestrator/dispatcher.test.ts
- docs/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-06: Story created with comprehensive implementation context for non-blocking execution and retry command
- 2026-03-06: Implementation complete — fixed build-command bug, added getStoryByKey, startPhase support, full retry command, 14 new tests (206 total)
