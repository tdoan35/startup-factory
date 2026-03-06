# Story 5.2: Status & Cost Commands

Status: done

## Story

As an operator,
I want to check the current build status and view cost breakdowns from the CLI,
so that I can monitor progress and understand spending.

## Acceptance Criteria

1. **Given** a build is in progress or has completed
   **When** the operator runs `startup-factory status`
   **Then** it reads the state file and displays: run status, number of stories by status (pending/in-progress/completed/failed), list of failed stories with reasons

2. **Given** a build is in progress or has completed
   **When** the operator runs `startup-factory cost`
   **Then** it reads the state file and displays: per-story cost breakdown (model tier, tokens, cost), cumulative run cost total

3. **Given** no state file exists (no build has been run)
   **When** the operator runs `startup-factory status` or `startup-factory cost`
   **Then** it displays a clear message that no build data was found

## Tasks / Subtasks

- [x] Task 1: Implement status command (AC: #1, #3)
  - [x] 1.1: Create `formatStatusOutput()` in `src/cli/status-command.ts` that accepts `AppState` and returns a formatted multi-line string showing run status, story counts by status, and failed story details
  - [x] 1.2: Implement state file detection — use `loadConfig()` to resolve `workspacePath`, construct `StateManager`, call `read()` wrapped in try/catch; on file-not-found display "No build data found" message and exit 0
  - [x] 1.3: Wire the status command action — load config, resolve workspace path, read state, format output, write to stdout via `process.stdout.write()`
  - [x] 1.4: Write unit tests for `formatStatusOutput()` covering: all-completed, partial (some failed), all-pending, and mixed states
  - [x] 1.5: Write unit test for no-state-file path (file not found handling)
- [x] Task 2: Implement cost command (AC: #2, #3)
  - [x] 2.1: Create `formatCostOutput()` in `src/cli/cost-command.ts` that accepts `AppState` and returns a formatted multi-line string showing per-story cost breakdown and cumulative total
  - [x] 2.2: Implement state file detection — same pattern as status command (load config, construct StateManager, try/catch on read)
  - [x] 2.3: Wire the cost command action — load config, resolve workspace path, read state, format output, write to stdout
  - [x] 2.4: Write unit tests for `formatCostOutput()` covering: stories with costs, stories with zero cost, and mixed scenarios
  - [x] 2.5: Write unit test for no-state-file path
- [x] Task 3: Integration and edge cases (AC: #1, #2, #3)
  - [x] 3.1: Add `--workspace-path` and `--config` options to both status and cost commands (same pattern as build/retry commands)
  - [x] 3.2: Write integration tests verifying full command flow: config loading -> state reading -> formatted output for both commands
  - [x] 3.3: Verify no regressions — run full test suite

## Dev Notes

### Architecture Requirements

- **Module boundary**: CLI commands read state via `StateManager.read()` — never touch files directly
- **Dependency pattern**: Pass dependencies as function parameters, no DI framework, no singletons
- **Async/await only**: All I/O is async, no callbacks or `.then()` chains
- **Output**: Use `process.stdout.write()` for command output (not `log()` from logger — that adds timestamps meant for build-time logging, not for query commands)
- **Exit codes**: Exit 0 on success (including "no build data" case), exit 2 only on system errors

### Existing Code to Reuse (DO NOT REINVENT)

**Stub files already exist** — implement inside them, do not create new files:
- `src/cli/status-command.ts` — has `registerStatusCommand()` stub, currently logs "not yet implemented"
- `src/cli/cost-command.ts` — has `registerCostCommand()` stub, currently logs "not yet implemented"

**State reading**:
- `StateManager` at `src/workspace/state-manager.ts` — use `read(): Promise<AppState>` to get full state
- `AppState` type at `src/workspace/types.ts` — contains `run: RunMeta` and `epics: Record<string, EpicState>`
- `RunMeta` has: `status`, `started`, `config`, `totalCost`
- `StoryState` has: `status`, `phase`, `attempts`, `cost`, `escalationTier?`, `failureNote?`
- `getStoriesByStatus()` convenience method available but iterating `state.epics` directly gives epic context

**Config loading** (for resolving workspace path):
- `loadConfig()` from `src/config/config-loader.ts` — returns `AppConfig` with `workspacePath`
- `mergeCliFlags()` from `src/config/merge-cli-flags.ts` — for `--workspace-path` override
- Default workspace: `.startup-factory`

**CLI registration pattern** (follow exactly):
```typescript
export function registerXxxCommand(program: Command): void {
  program
    .command('xxx')
    .description('...')
    .option('--workspace-path <path>', 'Workspace directory path')
    .option('--config <path>', 'Path to config file')
    .action(async (options) => { /* ... */ })
}
```

**Path resolution**: Use `resolve()` from `node:path` for absolute paths.

### Output Format Specifications

**Status command output** (human-readable, no timestamps):
```
=== BUILD STATUS ===
Run Status: partial
Started: 2026-03-06T22:00:00Z

Stories:
  Completed: 8
  Failed: 2
  In Progress: 0
  Pending: 0

Failed Stories:
  - 2-1 (development): Capability error
  - 3-2 (qa): Specification error
```

**Cost command output** (human-readable, no timestamps):
```
=== COST BREAKDOWN ===
Per-Story Costs:
  5-1: $0.42
  5-2: $0.35

Total Run Cost: $1.87
```

Note: Per-story cost data available is `StoryState.cost` (a single number). Individual agent-run token breakdowns are NOT stored in the state file — only the aggregated story cost. Display what is available: story key and total cost per story.

**No-build-data output**:
```
No build data found. Run 'startup-factory build' to start a build.
```

### Testing Approach

- **Framework**: Vitest, co-located `.test.ts` files
- **Test files**: `src/cli/status-command.test.ts` and `src/cli/cost-command.test.ts`
- **Unit test pattern**: Create mock `AppState` objects, pass to format functions, assert string output
- **Integration test pattern**: Mock `StateManager.read()` to return test state, verify full command output
- **No-state-file test**: Mock `StateManager.read()` to throw ENOENT-like error, verify "no build data" message
- **Mock pattern** (from story 5-1):
  ```typescript
  const mockStateManager = {
    read: vi.fn().mockResolvedValue(mockState),
  } as unknown as StateManager
  ```

### Project Structure Notes

- Both command files already exist in `src/cli/` — modify in place
- Test files go alongside: `src/cli/status-command.test.ts`, `src/cli/cost-command.test.ts`
- No new modules needed — this story only touches `src/cli/`
- Imports use `@/` path alias for cross-module imports (e.g., `import { StateManager } from '@/workspace/state-manager.js'`)
- Use `.js` extensions in all relative imports

### Previous Story Learnings (from 5-1)

- `CostTracker.updateRunCostInState()` persists `totalCost` to `state.run.totalCost` — cost data IS in the state file after a build
- Story costs stored in `state.epics[epicKey].stories[storyKey].cost` as a single number
- Mock pattern: use `vi.fn().mockResolvedValue(undefined)` for void async methods, `vi.fn().mockResolvedValue(value)` for returns
- Story 5-1 established the cost module — do not modify any cost module files
- 227 tests passing at end of story 5-1 — no regressions allowed

### References

- [Source: docs/planning-artifacts/epics.md#Epic 5 - Story 5.2]
- [Source: docs/planning-artifacts/architecture.md#CLI Commands]
- [Source: docs/planning-artifacts/architecture.md#Cost Tracking]
- [Source: docs/planning-artifacts/architecture.md#Output Formats]
- [Source: src/cli/status-command.ts - existing stub]
- [Source: src/cli/cost-command.ts - existing stub]
- [Source: src/workspace/state-manager.ts - StateManager.read()]
- [Source: src/workspace/types.ts - AppState, RunMeta, StoryState]
- [Source: src/config/config-loader.ts - loadConfig()]
- [Source: docs/implementation-artifacts/5-1-cost-tracker.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented `formatStatusOutput()` pure function: displays run status, started time, story counts by status (completed/failed/in-progress/pending), and lists failed stories with their phase
- Implemented `formatCostOutput()` pure function: displays per-story cost breakdown with $X.XX formatting and cumulative total run cost
- Both commands handle missing state file gracefully (ENOENT catch → "No build data found" message)
- Both commands accept `--workspace-path` and `--config` CLI options following existing command patterns
- Output uses `process.stdout.write()` (not logger) for clean query output without timestamps
- 13 new tests added (9 status + 8 cost, minus 4 existing registration tests = 13 net new); total test count: 240
- Zero regressions against 227-test baseline

### Change Log

- 2026-03-06: Implemented status and cost CLI commands with full test coverage
- 2026-03-06: Code review fixes — added failureNote display to status output (H1), defensive cost null checks (M2), added 12 missing integration/ENOENT/edge-case tests (H3). Test count: 240 → 252. AC #2 spec mismatch noted (model tier/tokens not in state).

### File List

- src/cli/status-command.ts (modified - replaced stub with full implementation; review: added failureNote display)
- src/cli/cost-command.ts (modified - replaced stub with full implementation; review: added defensive cost checks)
- src/cli/status-command.test.ts (modified - added formatStatusOutput tests + integration tests for action handler)
- src/cli/cost-command.test.ts (modified - added formatCostOutput tests + integration tests for action handler)
