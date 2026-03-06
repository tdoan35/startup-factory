# Story 1.3: Error Types & Exit Codes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the tool to return meaningful exit codes and use typed errors internally,
so that I can integrate it into scripts and trust that failures are categorized correctly.

## Acceptance Criteria

1. **Given** all stories in a build complete successfully, **When** the process exits, **Then** the exit code is 0.

2. **Given** some stories complete but others fail, **When** the process exits, **Then** the exit code is 1.

3. **Given** no stories complete or a system-level error occurs, **When** the process exits, **Then** the exit code is 2.

4. **Given** an error occurs during agent execution, **When** the error is created, **Then** it is an instance of `AgentError` with a `category` field set to one of: `Transient`, `Capability`, `Specification`, or `System`, **And** the error includes the `storyId` and an optional `cause` error.

5. **Given** the `ErrorCategory` enum, **When** used throughout the codebase, **Then** `Transient` maps to retry behavior, `Capability` maps to model escalation, `Specification` maps to human flagging, and `System` maps to hard stop.

## Tasks / Subtasks

- [x] Task 1: Create `ErrorCategory` enum and `AgentError` class (AC: #4, #5)
  - [x] 1.1: Create `src/errors/agent-error.ts` with `ErrorCategory` enum: `Transient`, `Capability`, `Specification`, `System` (PascalCase members, string values)
  - [x] 1.2: In same file, define `AgentError extends Error` with constructor params: `message: string`, `category: ErrorCategory`, `storyId: string`, `cause?: Error`
  - [x] 1.3: Set `this.name = 'AgentError'` in constructor for reliable `instanceof` checks and readable stack traces
  - [x] 1.4: Make all constructor params `readonly` public fields

- [x] Task 2: Create exit code utility (AC: #1, #2, #3)
  - [x] 2.1: Add `computeExitCode(completedCount: number, failedCount: number): 0 | 1 | 2` to `src/errors/agent-error.ts`
  - [x] 2.2: Logic: `completedCount === 0` → `2`, `failedCount === 0` → `0`, otherwise → `1`
  - [x] 2.3: Note: System errors (ErrorCategory.System) always cause the orchestrator to halt and call `process.exit(2)` directly — `computeExitCode` handles the data-driven case (counts from completed pipeline run)

- [x] Task 3: Update barrel exports (AC: all)
  - [x] 3.1: Update `src/errors/index.ts` to export `AgentError`, `ErrorCategory`, and `computeExitCode`

- [x] Task 4: Wire exit code into entry point (AC: #1, #2, #3)
  - [x] 4.1: Update `src/index.ts` to catch unhandled top-level errors and call `process.exit(2)` with a clear stderr message for System-category errors
  - [x] 4.2: Add a comment in `src/index.ts` noting that CLI commands will call `computeExitCode()` and `process.exit()` once the orchestrator (Epic 3) returns build results
  - [x] 4.3: Do NOT change the current placeholder `console.log` in CLI commands — that wiring happens in Epic 3

- [x] Task 5: Write tests (AC: #1, #2, #3, #4, #5)
  - [x] 5.1: Create `src/errors/agent-error.test.ts`
  - [x] 5.2: Test `AgentError` construction: verify `message`, `category`, `storyId`, `cause` are set correctly
  - [x] 5.3: Test `AgentError instanceof AgentError` returns true; verify `error.name === 'AgentError'`
  - [x] 5.4: Test `ErrorCategory` has all four expected string values: `Transient`, `Capability`, `Specification`, `System`
  - [x] 5.5: Test `computeExitCode(10, 0)` → `0`; `computeExitCode(8, 2)` → `1`; `computeExitCode(0, 5)` → `2`; `computeExitCode(0, 0)` → `2` (no stories at all = total failure)
  - [x] 5.6: Run `npm test` and verify all tests pass (target: all 56 existing tests + new tests)

## Dev Notes

### Architecture Requirements

- **Errors module location:** `src/errors/` — the sole home for typed error classes. All other modules import from `@/errors` (path alias, not relative paths across module boundaries).
- **Never `throw new Error(...)`:** Every thrown error in the codebase must be a typed class instance. `AgentError` is the canonical agent-execution error. Config errors use the local `ConfigError` (see below).
- **ErrorCategory is an enum, not a string union:** Use `enum ErrorCategory` with PascalCase string values. This allows `instanceof`-style narrowing on the category and produces readable error messages.
- **Exit codes handled at `src/index.ts`:** The process entry point is responsible for calling `process.exit()`. CLI commands return structured results; `src/index.ts` translates to exit codes. This pattern keeps exit-code logic centralized and testable.
- **`computeExitCode` is forward-looking:** The orchestrator doesn't exist yet (Epic 3). For this story, implement and test the utility in isolation. CLI commands will call it in Epic 3 once they have real build results.

### Error Class Design (from Architecture doc)

The architecture document specifies this exact pattern:

```typescript
export enum ErrorCategory {
  Transient = 'Transient',
  Capability = 'Capability',
  Specification = 'Specification',
  System = 'System',
}

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly storyId: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'AgentError'
  }
}
```

**ErrorCategory semantics (drives all escalation behavior in Epic 4):**

| Category | Meaning | Orchestrator Response |
|----------|---------|----------------------|
| `Transient` | API timeout, rate limit, network error | Retry same model tier |
| `Capability` | Agent couldn't complete the task | Escalate to higher model tier |
| `Specification` | Ambiguous or conflicting spec | Flag for human attention, mark story failed |
| `System` | Orchestrator bug, file I/O error | Halt pipeline immediately, exit code 2 |

### Exit Code Logic

```typescript
export function computeExitCode(completedCount: number, failedCount: number): 0 | 1 | 2 {
  if (completedCount === 0) return 2  // all failed, or system error with no completions
  if (failedCount === 0) return 0    // all succeeded
  return 1                           // partial success
}
```

**Exit code scenarios:**
- `(10, 0)` → `0`: 10 stories completed, 0 failed — full success
- `(8, 2)` → `1`: 8 completed, 2 failed — partial success
- `(0, 5)` → `2`: 0 completed, 5 failed — total failure
- `(0, 0)` → `2`: no stories at all — total failure (edge case: empty pipeline or system crash before any story ran)

**System error exit (Category.System):** The orchestrator (Epic 3 dispatcher) will catch a `System` category error and call `process.exit(2)` directly, without going through `computeExitCode`. This is because a System error means the pipeline itself is broken, not just that stories failed.

### About ConfigError (from Story 1.2)

Story 1.2 introduced a local `ConfigError extends Error` in `src/config/config-loader.ts` as a temporary placeholder until Story 1.3 established canonical error types. **`ConfigError` is NOT an `AgentError`** — config validation failures are a different domain from agent execution failures. Do NOT merge or replace `ConfigError` with `AgentError`.

The long-term action (deferred to future cleanup) is to consider whether config errors should use `AgentError` with `ErrorCategory.System` (since an invalid config is a system-level failure). For MVP, leave `ConfigError` as-is in `src/config/config-loader.ts`. The architecture does not require unifying them for this story.

### src/index.ts Exit Code Wiring

The current `src/index.ts` entry point sets up the Commander program and registers commands. After this story, add top-level error handling:

```typescript
// In src/index.ts — add after program setup:
process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err.message)
  process.exit(2)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled error:', reason)
  process.exit(2)
})
```

This ensures System-category errors that bubble up uncaught result in exit code 2. Individual CLI command actions will call `process.exit(computeExitCode(...))` explicitly once Epic 3 provides real results.

### Previous Story Intelligence

**From Story 1.2 (Configuration Loading):**

- `ConfigError extends Error` lives in `src/config/config-loader.ts` — temporary placeholder, leave it there
- All CLI commands import from `@commander-js/extra-typings`
- `moduleResolution` is `"bundler"` — all relative imports need `.js` extension (e.g., `'./agent-error.js'`)
- 56 tests currently passing across all test files — must not regress
- Pattern for `this.name` in error classes: Story 1.2's `ConfigError` sets `this.name = 'ConfigError'` — follow same pattern for `AgentError`
- Barrel re-export pattern: `export { AgentError, ErrorCategory, computeExitCode } from './agent-error.js'`

**From Story 1.1 (Project Scaffold):**

- `src/errors/index.ts` currently contains only `export {}` — replace completely with actual exports
- All 8 module directories were created with empty barrel files in Story 1.1
- Tests co-located: `src/errors/agent-error.test.ts` next to `src/errors/agent-error.ts`

### Project Structure Notes

**Files to CREATE:**
```
src/errors/agent-error.ts        # ErrorCategory enum, AgentError class, computeExitCode
src/errors/agent-error.test.ts   # Tests for all error types and exit code utility
```

**Files to MODIFY:**
```
src/errors/index.ts              # Replace empty export with real barrel exports
src/index.ts                     # Add uncaughtException/unhandledRejection handlers
```

**Files to NOT touch:**
```
src/config/config-loader.ts      # Leave ConfigError as-is
src/cli/                         # No changes — exit code wiring deferred to Epic 3
src/orchestrator/                # Epic 3
src/agents/                      # Epic 3
src/workspace/                   # Epic 2
```

**No new module directories needed** — `src/errors/` already exists from Story 1.1.

### Anti-Patterns to Avoid

- **DO NOT** use string literals for error categories (`'transient'`) — use `ErrorCategory.Transient` enum values
- **DO NOT** create `IAgentError` or `TAgentError` — no prefixes on types (architecture rule)
- **DO NOT** use relative cross-module imports — when other modules need `AgentError`, they use `@/errors` (not `../../errors/...`)
- **DO NOT** use `agent_error.ts` or `AgentError.ts` — files are always kebab-case
- **DO NOT** skip `this.name = 'AgentError'` — without it, `error.name` defaults to `'Error'` which makes debugging harder
- **DO NOT** put exit code logic in CLI commands — it belongs in the entry point and as a testable utility
- **DO NOT** make `ErrorCategory` a const enum — plain enum preserves runtime values for comparison and serialization to state file

### Testing Approach

```typescript
import { describe, it, expect } from 'vitest'
import { AgentError, ErrorCategory, computeExitCode } from './agent-error.js'

describe('AgentError', () => {
  it('constructs with required fields', () => {
    const err = new AgentError('agent failed', ErrorCategory.Capability, 'story-1-2')
    expect(err.message).toBe('agent failed')
    expect(err.category).toBe(ErrorCategory.Capability)
    expect(err.storyId).toBe('story-1-2')
    expect(err.cause).toBeUndefined()
  })

  it('is an instance of Error and AgentError', () => {
    const err = new AgentError('fail', ErrorCategory.System, '1-3')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof AgentError).toBe(true)
    expect(err.name).toBe('AgentError')
  })

  it('accepts optional cause', () => {
    const cause = new Error('root cause')
    const err = new AgentError('wrapped', ErrorCategory.Transient, '1-1', cause)
    expect(err.cause).toBe(cause)
  })
})

describe('ErrorCategory', () => {
  it('has all four categories', () => {
    expect(ErrorCategory.Transient).toBe('Transient')
    expect(ErrorCategory.Capability).toBe('Capability')
    expect(ErrorCategory.Specification).toBe('Specification')
    expect(ErrorCategory.System).toBe('System')
  })
})

describe('computeExitCode', () => {
  it('returns 0 when all stories completed', () => {
    expect(computeExitCode(10, 0)).toBe(0)
  })
  it('returns 1 when some stories failed', () => {
    expect(computeExitCode(8, 2)).toBe(1)
  })
  it('returns 2 when no stories completed', () => {
    expect(computeExitCode(0, 5)).toBe(2)
  })
  it('returns 2 when no stories ran at all', () => {
    expect(computeExitCode(0, 0)).toBe(2)
  })
})
```

### References

- [Source: docs/planning-artifacts/architecture.md#Error-Handling-&-Logging] — ErrorCategory table, escalation mapping
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — AgentError class pattern with exact constructor signature
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/errors/agent-error.ts`, `src/errors/agent-error.test.ts`
- [Source: docs/planning-artifacts/architecture.md#Gaps-Identified-and-Resolved] — Gap 3: Exit Codes (FR42), exit code 0/1/2 semantics
- [Source: docs/planning-artifacts/epics.md#Story-1.3] — Story requirements and acceptance criteria
- [Source: docs/planning-artifacts/prd.md#FR42] — "System can return meaningful exit codes (0 = full success, 1 = partial success, 2 = total failure)"
- [Source: docs/implementation-artifacts/1-2-configuration-loading-cli-flag-merging.md#Dev-Notes] — ConfigError placeholder note, file extension conventions, 56 tests currently passing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded cleanly with no issues.

### Completion Notes List

- Created `src/errors/agent-error.ts` with `ErrorCategory` enum (4 members with PascalCase string values), `AgentError extends Error` class (message, category, storyId, cause fields; name = 'AgentError'), and `computeExitCode` utility function
- Updated `src/errors/index.ts` barrel to export all three symbols
- Updated `src/index.ts` with `uncaughtException` and `unhandledRejection` process handlers + Epic 3 TODO comment
- Created `src/errors/agent-error.test.ts` with 8 tests covering all ACs
- All 64 tests pass (56 pre-existing + 8 new); zero regressions

### File List

- src/errors/agent-error.ts (created, modified by review)
- src/errors/agent-error.test.ts (created)
- src/errors/index.ts (modified)
- src/index.ts (modified)
- src/errors/process-handlers.ts (created by review)
- src/errors/process-handlers.test.ts (created by review)

## Change Log

- 2026-03-05: Story 1.3 implemented — ErrorCategory enum, AgentError class, computeExitCode utility, barrel exports, process-level exit code handlers. 8 tests added, all 64 tests pass.
- 2026-03-05: Code review fixes — M1: AgentError now passes `{ cause }` to `super()` for native ES2022 error chaining. M2+M3: Process handlers extracted to `src/errors/process-handlers.ts` (testable), `unhandledRejection` now safely extracts message from unknown reason. 3 new tests added, 67 tests pass.
