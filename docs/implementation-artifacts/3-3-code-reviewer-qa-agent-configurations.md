# Story 3.3: Code Reviewer & QA Agent Configurations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want configured Code Reviewer and QA agents with role-specific prompts and tool permissions,
So that generated code is reviewed for quality and validated against acceptance criteria.

## Acceptance Criteria

1. **Given** the Code Reviewer agent configuration, **When** the agent is dispatched after development, **Then** it has read access to the workspace (story spec, generated code, existing code) **And** it has write access to create review feedback files (`stories/{epic}-{story}/review.md`) **And** its system prompt instructs it to review code for quality, correctness, spec adherence, and maintainability **And** the review output is either an approval or actionable feedback describing what needs to change.

2. **Given** the QA agent configuration, **When** the agent is dispatched after code review approval, **Then** it has read access to the workspace (story spec, generated code, review) **And** it has Bash access to run tests and validate the application starts **And** it has write access to create QA reports (`stories/{epic}-{story}/qa-report.md`) **And** its system prompt instructs it to run tests, validate app behavior against acceptance criteria, and report pass/fail with details.

3. **Given** either agent's configuration, **When** inspecting the config.ts file, **Then** it specifies the model tier, tool permissions, and retry settings as a typed `AgentRoleConfig` TypeScript object **And** the system prompt is stored as a separate `prompt.md` file with `promptPath` in the config pointing to it.

## Tasks / Subtasks

- [x] Task 1: Create Code Reviewer agent configuration (AC: #1, #3)
  - [x] 1.1: Create `src/agents/code-reviewer/config.ts` — export `codeReviewerConfig: AgentRoleConfig` with `model: 'claude-sonnet-4-6'`, `allowedTools: ['Read', 'Glob', 'Grep', 'Write']`, `maxRetries: 3`, `promptPath` resolved from `import.meta.url`
  - [x] 1.2: Create `src/agents/code-reviewer/prompt.md` — complete system prompt instructing agent to review code for quality, correctness, spec adherence, and maintainability; output is either APPROVED or CHANGES REQUESTED with specific actionable items

- [x] Task 2: Create QA agent configuration (AC: #2, #3)
  - [x] 2.1: Create `src/agents/qa/config.ts` — export `qaConfig: AgentRoleConfig` with `model: 'claude-sonnet-4-6'`, `allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Write']`, `maxRetries: 3`, `promptPath` resolved from `import.meta.url`
  - [x] 2.2: Create `src/agents/qa/prompt.md` — complete system prompt instructing agent to run tests (`npm test`), validate app starts, validate behavior against acceptance criteria, and write a pass/fail report with details per AC

- [x] Task 3: Write co-located tests for agent configurations (AC: #1, #2, #3)
  - [x] 3.1: Create `src/agents/code-reviewer/config.test.ts` — verify model, allowedTools (contains Read/Glob/Grep/Write, does NOT contain Bash or Edit, has exactly 4 tools), maxRetries, and promptPath points to existing .md file
  - [x] 3.2: Create `src/agents/qa/config.test.ts` — verify model, allowedTools (contains Read/Glob/Grep/Bash/Write, does NOT contain Edit, has exactly 5 tools), maxRetries, and promptPath points to existing .md file
  - [x] 3.3: Run `npm test` to confirm all pre-existing tests (122 as of story 3.2) plus new tests pass with no regressions

## Dev Notes

### Architecture Requirements

**New files to CREATE:**
```
src/agents/code-reviewer/config.ts        # Code Reviewer AgentRoleConfig object
src/agents/code-reviewer/prompt.md        # Code Reviewer system prompt (loaded at runtime)
src/agents/code-reviewer/config.test.ts   # Config shape + file existence tests
src/agents/qa/config.ts                   # QA AgentRoleConfig object
src/agents/qa/prompt.md                   # QA system prompt (loaded at runtime)
src/agents/qa/config.test.ts              # Config shape + file existence tests
```

**Files NOT to touch:**
- `src/agents/types.ts` — `AgentRoleConfig` already defined and exported (Story 3.2 done)
- `src/agents/index.ts` — `AgentRoleConfig` already in barrel (Story 3.2 done)
- `src/agents/agent-runner.ts`, `src/agents/claude-agent-runner.ts` and their tests — Story 3.1 territory
- `src/agents/story-creator/`, `src/agents/developer/` — Story 3.2 territory, already done
- `src/orchestrator/` — Story 3.4 territory
- Any file outside `src/agents/code-reviewer/` and `src/agents/qa/` — out of scope

### AgentRoleConfig Type (Already Exists — Reference Only)

`AgentRoleConfig` is already defined in `src/agents/types.ts` and exported from `src/agents/index.ts`:

```typescript
export interface AgentRoleConfig {
  model: string          // e.g., 'claude-sonnet-4-6' or 'claude-opus-4-6'
  allowedTools: string[] // Tools auto-approved for this agent role (no permission prompts)
  maxRetries: number     // Max retry attempts before escalation kicks in
  promptPath: string     // Absolute path to the system prompt .md file (loaded at runtime)
}
```

Do NOT redefine it — import from `'../types.js'`.

### Config.ts Pattern — ESM `__dirname` Equivalent

The project uses `"type": "module"` in package.json. Use the standard ESM pattern (same as story-creator and developer):

```typescript
// src/agents/code-reviewer/config.ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const codeReviewerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
```

```typescript
// src/agents/qa/config.ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const qaConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
```

### Tool Permissions Rationale

**Code Reviewer (`allowedTools: ['Read', 'Glob', 'Grep', 'Write']`):**
- `Read` — reads story spec from `.startup-factory/stories/{epic}-{story}/spec.md`, generated source files, existing codebase
- `Glob` — discovers generated and existing source files by pattern
- `Grep` — searches codebase for patterns, existing implementations, and anti-patterns
- `Write` — creates review feedback file at `{{workspacePath}}/stories/{epic}-{story}/review.md` (always a new file)
- **Excluded `Edit`** — review.md is always created fresh; no existing files need modification
- **Excluded `Bash`** — Code Reviewer only reads code and writes a review; no test execution

**QA (`allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Write']`):**
- `Read` — reads story spec, generated code, and code review feedback
- `Glob` — discovers test files and source files
- `Grep` — searches test output and source for acceptance-criteria-relevant patterns
- `Bash` — runs `npm test`, `npm run build` (if needed to validate compilation), and other validation commands
- `Write` — creates QA report at `{{workspacePath}}/stories/{epic}-{story}/qa-report.md` (always a new file)
- **Excluded `Edit`** — qa-report.md is always created fresh; no existing files need modification

### System Prompt Content Requirements

**`src/agents/code-reviewer/prompt.md` MUST include:**
1. Agent role and purpose statement (Code Reviewer in startup-factory pipeline)
2. Workspace file locations:
   - Story spec: `{{workspacePath}}/stories/{epic}-{story}/spec.md`
   - Source code: project source directory (use Glob to discover)
   - Write review to: `{{workspacePath}}/stories/{epic}-{story}/review.md`
3. Review checklist (what to evaluate):
   - Functional correctness: does implementation satisfy every AC in spec?
   - Code quality: TypeScript strict mode, proper types, no `any`
   - Architecture compliance: kebab-case files, PascalCase types (no `I` prefix), camelCase variables, `UPPER_SNAKE_CASE` constants
   - Import conventions: `node:` prefix for Node.js built-ins, `@/` aliases for cross-module imports, `.js` extensions in relative imports
   - Async patterns: `async/await` only — no `.then()` chains or callbacks
   - Test completeness: co-located `.test.ts` files cover all new functionality
   - Error handling: typed `AgentError` instances with correct `ErrorCategory` (no raw `throw new Error(...)`)
   - No scope creep: only what the story spec required, nothing extra
4. Review output format (MUST use one of these two verdict headers):
   - **APPROVED**: Brief summary of what was reviewed, confirmation all ACs are met
   - **CHANGES REQUESTED**: Numbered list of specific, actionable changes with file references (e.g., "In `src/agents/foo.ts` line 12: replace `any` with `AgentConfig`")
5. Quality standards: every finding must cite file + line or section; no vague feedback

**`src/agents/qa/prompt.md` MUST include:**
1. Agent role and purpose statement (QA agent in startup-factory pipeline)
2. Workspace file locations:
   - Story spec: `{{workspacePath}}/stories/{epic}-{story}/spec.md`
   - Code review: `{{workspacePath}}/stories/{epic}-{story}/review.md`
   - Generated source code: project source directory
   - Write QA report to: `{{workspacePath}}/stories/{epic}-{story}/qa-report.md`
3. Validation steps:
   - Run `npm test` from the project root — capture output
   - If `npm run build` is needed to verify compilation, run it
   - Read spec.md and enumerate every acceptance criterion
   - For each AC, determine pass/fail based on test output and code inspection
4. QA report output format:
   - Summary section: overall PASS or FAIL verdict
   - Test run section: `npm test` output summary (pass/fail counts)
   - Per-AC section: each AC listed with PASS/FAIL and evidence
   - Issues section (if FAIL): numbered list of failing ACs with specific details
5. Quality standards: must run actual tests before reporting; no assumed pass/fail without evidence

### Testing Pattern

```typescript
// src/agents/code-reviewer/config.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { codeReviewerConfig } from './config.js'

describe('codeReviewerConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(codeReviewerConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Write in allowedTools', () => {
    expect(codeReviewerConfig.allowedTools).toContain('Read')
    expect(codeReviewerConfig.allowedTools).toContain('Glob')
    expect(codeReviewerConfig.allowedTools).toContain('Grep')
    expect(codeReviewerConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Bash in allowedTools (review reads and writes only)', () => {
    expect(codeReviewerConfig.allowedTools).not.toContain('Bash')
  })

  it('does NOT include Edit in allowedTools (review.md is always a new file)', () => {
    expect(codeReviewerConfig.allowedTools).not.toContain('Edit')
  })

  it('has exactly 4 allowed tools', () => {
    expect(codeReviewerConfig.allowedTools).toHaveLength(4)
  })

  it('has maxRetries of 3', () => {
    expect(codeReviewerConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(codeReviewerConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(codeReviewerConfig.promptPath)).toBe(true)
  })
})
```

```typescript
// src/agents/qa/config.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { qaConfig } from './config.js'

describe('qaConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(qaConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Bash, Write in allowedTools', () => {
    expect(qaConfig.allowedTools).toContain('Read')
    expect(qaConfig.allowedTools).toContain('Glob')
    expect(qaConfig.allowedTools).toContain('Grep')
    expect(qaConfig.allowedTools).toContain('Bash')
    expect(qaConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Edit in allowedTools (qa-report.md is always a new file)', () => {
    expect(qaConfig.allowedTools).not.toContain('Edit')
  })

  it('has exactly 5 allowed tools', () => {
    expect(qaConfig.allowedTools).toHaveLength(5)
  })

  it('has maxRetries of 3', () => {
    expect(qaConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(qaConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(qaConfig.promptPath)).toBe(true)
  })
})
```

### Project Structure Notes

- `src/agents/code-reviewer/` and `src/agents/qa/` are new subdirectories — same pattern as `story-creator/` and `developer/`
- No `index.ts` barrel needed inside these directories — orchestrator will import from them directly
- Do NOT add `codeReviewerConfig` or `qaConfig` to `src/agents/index.ts` barrel — only `AgentRoleConfig` type belongs there (already added in 3.2)
- `tsup.config.ts` already has the `onSuccess` hook to copy `.md` files from `src/` to `dist/` (added in 3.2 code review) — `prompt.md` files will be included in build output automatically

### Previous Story Intelligence (Story 3.2)

**122 tests currently passing** (after Story 3.2 code review fixes) — verify no regressions after all changes.

**Patterns established in 3.2 to continue exactly:**
- ESM `__dirname` equivalent: `dirname(fileURLToPath(import.meta.url))` — mandatory, not `__dirname` directly
- `promptPath` MUST resolve to absolute path at module init time: `join(__dirname, 'prompt.md')`
- `node:` prefix for all Node.js built-in imports: `node:url`, `node:path`
- Relative imports within `src/agents/` use `.js` extension: `from '../types.js'`
- `import type { AgentRoleConfig }` — it's a type-only import
- prompt.md files use `{{workspacePath}}` placeholder (NOT hardcoded `.startup-factory/`) — the orchestrator (Story 3.4) will substitute the actual path at dispatch time
- Co-located tests import from `'./config.js'` (relative, `.js` extension)
- `toHaveLength(N)` assertion added for exact tool count enforcement (per code review fix in 3.2)
- prompt.md files MUST be complete and actionable — tests verify file existence; empty or placeholder files will fail

**Current state of `src/agents/types.ts`:**
Contains `AgentConfig`, `AgentCostData`, `AgentResult`, `AgentRoleConfig` — no changes needed.

**Current state of `src/agents/index.ts`:**
```typescript
export type { AgentRunner } from './agent-runner.js'
export { ClaudeAgentRunner } from './claude-agent-runner.js'
export type { AgentConfig, AgentResult, AgentCostData, AgentRoleConfig } from './types.js'
```
No changes needed — already has `AgentRoleConfig`.

### Anti-Patterns to Avoid

- **DO NOT** use `__dirname` directly — ESM modules don't have it; use `dirname(fileURLToPath(import.meta.url))`
- **DO NOT** inline the system prompt as a string in config.ts — architecture requires separate `prompt.md`
- **DO NOT** add `index.ts` barrels to `code-reviewer/` or `qa/` — they are internal agent directories
- **DO NOT** import from `@/orchestrator/`, `@/workspace/`, or any other module — agent configs only import from `../types.js` and Node.js built-ins
- **DO NOT** add `Edit` to Code Reviewer's allowedTools — review.md is always a new file
- **DO NOT** add `Bash` to Code Reviewer's allowedTools — code review is read + write only
- **DO NOT** add `Edit` to QA's allowedTools — qa-report.md is always a new file
- **DO NOT** set `promptPath` to a relative path string — always resolve to absolute using `join(__dirname, 'prompt.md')`
- **DO NOT** add `codeReviewerConfig` or `qaConfig` to `src/agents/index.ts` barrel — that barrel only exposes types and the runner class
- **DO NOT** write placeholder prompt.md files — both prompts must be complete and actionable; tests verify file existence
- **DO NOT** hardcode `.startup-factory/` paths in prompt.md — use `{{workspacePath}}` placeholder for Story 3.4 orchestrator substitution
- **DO NOT** touch the pre-existing typecheck error in `src/agents/claude-agent-runner.test.ts:34` — it is Story 3.1 territory

### References

- [Source: docs/planning-artifacts/architecture.md#Agent-Configuration-Pattern] — "Hybrid: structural config in TypeScript (config.ts) and system prompts as external markdown (prompt.md)"; layout shows `code-reviewer/config.ts`, `code-reviewer/prompt.md`, `qa/config.ts`, `qa/prompt.md`
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — Confirmed paths: `src/agents/code-reviewer/config.ts`, `src/agents/code-reviewer/prompt.md`, `src/agents/qa/config.ts`, `src/agents/qa/prompt.md`
- [Source: docs/planning-artifacts/epics.md#Story-3.3] — Exact AC text: Code Reviewer (read workspace + write review.md + system prompt), QA (read workspace + Bash + write qa-report.md + system prompt), config.ts inspection requirements
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — kebab-case files, PascalCase types no prefix, `node:` prefix, `async/await`, `@/` aliases, `.js` extensions
- [Source: docs/planning-artifacts/architecture.md#Workspace-Directory-Structure] — review.md at `.startup-factory/stories/{epic}-{story}/review.md`; qa-report.md at `.startup-factory/stories/{epic}-{story}/qa-report.md`
- [Source: docs/implementation-artifacts/3-2-story-creator-developer-agent-configurations.md#Completion-Notes-List] — 122 tests passing after code review; `{{workspacePath}}` placeholder in prompts; `toHaveLength` assertions required; tsup.config.ts already copies .md files; pre-existing typecheck error in claude-agent-runner.test.ts not to be touched
- [Source: docs/implementation-artifacts/3-2-story-creator-developer-agent-configurations.md#Dev-Notes] — ESM `__dirname` pattern, config.ts structure, tool rationale, promptPath absolute resolution

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/agents/code-reviewer/config.ts` exporting `codeReviewerConfig: AgentRoleConfig` with model `claude-sonnet-4-6`, tools `['Read', 'Glob', 'Grep', 'Write']`, maxRetries 3, promptPath resolved via ESM `__dirname` equivalent.
- Created `src/agents/code-reviewer/prompt.md` — complete reviewer prompt covering functional correctness, code quality, architecture compliance, test completeness, spec adherence, and maintainability. Outputs APPROVED or CHANGES REQUESTED with per-AC verification table.
- Created `src/agents/qa/config.ts` exporting `qaConfig: AgentRoleConfig` with model `claude-sonnet-4-6`, tools `['Read', 'Glob', 'Grep', 'Bash', 'Write']`, maxRetries 3, promptPath resolved via ESM `__dirname` equivalent.
- Created `src/agents/qa/prompt.md` — complete QA prompt covering test execution (`npm test`), per-AC validation, and structured PASS/FAIL report with evidence requirements.
- Created `src/agents/code-reviewer/config.test.ts` — 7 tests verifying model, tools (exactly 4), exclusions (Bash, Edit), maxRetries, and promptPath existence.
- Created `src/agents/qa/config.test.ts` — 6 tests verifying model, tools (exactly 5), exclusions (Edit), maxRetries, and promptPath existence.
- All 135 tests pass (122 pre-existing + 13 new). No regressions.
- Code review fixes applied: clarified import convention guidance in `code-reviewer/prompt.md` (M2); added Step 3b "validate the application starts" to `qa/prompt.md` (M1); added CHANGES REQUESTED verdict rule to QA verdict logic (M3).

### File List

- src/agents/code-reviewer/config.ts
- src/agents/code-reviewer/prompt.md
- src/agents/code-reviewer/config.test.ts
- src/agents/qa/config.ts
- src/agents/qa/prompt.md
- src/agents/qa/config.test.ts

## Change Log

- 2026-03-05: Story 3.3 implemented — Code Reviewer and QA agent configs, prompts, and tests (13 new tests, 135 total passing)
- 2026-03-05: Code review fixes — import convention ambiguity fix (code-reviewer/prompt.md), app-start validation step added (qa/prompt.md), CHANGES REQUESTED verdict rule added (qa/prompt.md)
