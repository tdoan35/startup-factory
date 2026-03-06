# Story 5.3: Completion Summary & Output Formats

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want to see a clear completion summary when a build finishes, with the option to get it in JSON or YAML format,
so that I can quickly understand results and pipe output to other tools.

## Acceptance Criteria

1. **Given** a build completes (full success, partial success, or total failure)
   **When** the completion summary is generated
   **Then** it displays to stdout: total stories completed/failed, test results summary, total cost, and list of any failed stories with failure reasons

2. **Given** the operator passes `--output json` flag to the build command
   **When** the completion summary is generated
   **Then** the summary is output as a valid JSON object to stdout instead of human-readable text

3. **Given** the operator passes `--output yaml` flag to the build command
   **When** the completion summary is generated
   **Then** the summary is output as valid YAML to stdout instead of human-readable text

4. **Given** default execution (no --output flag)
   **When** the completion summary is generated
   **Then** the summary is displayed as formatted, human-readable text with clear section headers

## Tasks / Subtasks

- [x] Task 1: Create `src/output/summary.ts` with summary generation functions (AC: #1, #2, #3, #4)
  - [x] 1.1: Define `CompletionSummary` interface: `{ runStatus, storiesCompleted, storiesFailed, storiesPending, totalCost, failedStories: { key, phase, reason }[], startedAt, completedAt }`
  - [x] 1.2: Implement `buildCompletionSummary(state: AppState): CompletionSummary` — extracts summary data from state file
  - [x] 1.3: Implement `formatSummaryText(summary: CompletionSummary): string` — human-readable text output with clear section headers
  - [x] 1.4: Implement `formatSummaryJson(summary: CompletionSummary): string` — valid JSON output via `JSON.stringify(summary, null, 2)`
  - [x] 1.5: Implement `formatSummaryYaml(summary: CompletionSummary): string` — valid YAML output via `yaml.stringify(summary)`
  - [x] 1.6: Implement `formatSummary(summary: CompletionSummary, format: OutputFormat): string` — dispatcher that calls the correct formatter based on format

- [x] Task 2: Add `--output` flag to build command (AC: #2, #3, #4)
  - [x] 2.1: Define `OutputFormat` type: `'text' | 'json' | 'yaml'` in `src/output/summary.ts`
  - [x] 2.2: Add `.option('--output <format>', 'Output format (text, json, yaml)')` to the build command in `src/cli/build-command.ts`
  - [x] 2.3: Parse and validate the `--output` flag value (default to `'text'` if not provided; error on invalid values)
  - [x] 2.4: After dispatcher completes and run status is updated, call `stateManager.read()` to get final state, then generate and output the completion summary before `process.exit()`

- [x] Task 3: Update barrel exports (AC: #1)
  - [x] 3.1: Update `src/output/index.ts` to export `buildCompletionSummary`, `formatSummary`, `CompletionSummary`, `OutputFormat`

- [x] Task 4: Create tests (AC: #1, #2, #3, #4)
  - [x] 4.1: Create `src/output/summary.test.ts` with unit tests for `buildCompletionSummary()` — all-completed state, partial state, total failure state
  - [x] 4.2: Test `formatSummaryText()` — verify human-readable output contains story counts, cost, failed story list
  - [x] 4.3: Test `formatSummaryJson()` — verify output is valid JSON via `JSON.parse()`
  - [x] 4.4: Test `formatSummaryYaml()` — verify output is valid YAML via `yaml.parse()`
  - [x] 4.5: Test `formatSummary()` dispatcher — verify correct formatter called for each format
  - [x] 4.6: Test build command integration — verify summary is output before exit (mock StateManager, verify stdout)

## Dev Notes

### Critical: What Already Exists

**`src/output/summary.ts` does NOT exist** — this is a new file. The architecture spec (`docs/planning-artifacts/architecture.md`) lists it in the project structure as `src/output/summary.ts` for FR40-41.

**`src/output/logger.ts`** already exists with `log()` and `logError()` — these are timestamped build-time log functions. The completion summary should NOT use these; it should write directly to `process.stdout.write()` for clean output (same pattern as status and cost commands).

**`src/cli/build-command.ts`** currently:
- Has NO `--output` flag
- Calls `runDispatcher()` → computes exit code → updates run status → calls `process.exit(exitCode)`
- The summary must be inserted **between** `stateManager.updateRun()` and `process.exit()` — re-read state after updating, build summary, format, output

**`yaml` package** is already a project dependency (used in `state-manager.ts`) — use `import { stringify } from 'yaml'` for YAML output format. Do NOT add new dependencies.

**`src/workspace/types.ts`** — `AppState` structure:
```typescript
interface AppState {
  run: RunMeta         // { status, started, config, totalCost }
  epics: Record<string, EpicState>  // epic key → { status, stories }
}
interface StoryState {
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  phase: StoryPhase
  attempts: number
  cost: number
  escalationTier?: number
  failureNote?: string
}
```

**`computeExitCode()`** in `src/errors/agent-error.ts`:
- 0: all completed (completedCount > 0, failedCount === 0)
- 1: partial (completedCount > 0, failedCount > 0)
- 2: total failure (completedCount === 0)

**`DispatcherResult`** returned by `runDispatcher()`:
```typescript
interface DispatcherResult {
  completedCount: number
  failedCount: number
}
```

### CompletionSummary Interface Design

```typescript
export type OutputFormat = 'text' | 'json' | 'yaml'

export interface FailedStoryInfo {
  key: string
  phase: string
  reason: string
}

export interface CompletionSummary {
  runStatus: string
  storiesCompleted: number
  storiesFailed: number
  storiesPending: number
  totalCost: number
  failedStories: FailedStoryInfo[]
  startedAt: string
}
```

### buildCompletionSummary Implementation

Extract from `AppState` by iterating `state.epics`:
```typescript
export function buildCompletionSummary(state: AppState): CompletionSummary {
  let completed = 0, failed = 0, pending = 0
  const failedStories: FailedStoryInfo[] = []

  for (const [epicKey, epic] of Object.entries(state.epics)) {
    for (const [storyKey, story] of Object.entries(epic.stories)) {
      if (story.status === 'completed') completed++
      else if (story.status === 'failed') {
        failed++
        failedStories.push({
          key: storyKey,
          phase: story.phase,
          reason: story.failureNote ?? 'Unknown failure',
        })
      } else pending++
    }
  }

  return {
    runStatus: state.run.status,
    storiesCompleted: completed,
    storiesFailed: failed,
    storiesPending: pending,
    totalCost: state.run.totalCost,
    failedStories,
    startedAt: state.run.started,
  }
}
```

### Human-Readable Text Format (AC #4)

```
=== BUILD COMPLETE ===
Run Status: completed
Started: 2026-03-06T22:00:00Z

Stories:
  Completed: 10
  Failed: 0
  Pending: 0

Total Cost: $4.23
```

With failures (AC #1):
```
=== BUILD COMPLETE ===
Run Status: partial
Started: 2026-03-06T22:00:00Z

Stories:
  Completed: 8
  Failed: 2
  Pending: 0

Failed Stories:
  - 2-1 (development): Capability error - agent could not complete implementation
  - 3-2 (qa): Specification error - ambiguous acceptance criteria

Total Cost: $4.23
```

### Build Command Integration

```typescript
// In build-command.ts, add to the action handler:
// After:
await stateManager.updateRun({ status: runStatus })

// Add:
const finalState = await stateManager.read()
const summary = buildCompletionSummary(finalState)
const outputFormat = (options.output as OutputFormat) ?? 'text'
process.stdout.write(formatSummary(summary, outputFormat) + '\n')

process.exit(exitCode)
```

The `--output` option:
```typescript
.option('--output <format>', 'Output format for completion summary (text, json, yaml)')
```

Validate format before running the build — fail fast if invalid:
```typescript
const outputFormat: OutputFormat = (options.output as OutputFormat) ?? 'text'
if (!['text', 'json', 'yaml'].includes(outputFormat)) {
  logError(`Invalid output format: ${options.output}. Use text, json, or yaml.`)
  process.exit(2)
}
```

### File Changes

```
src/output/
  summary.ts           (NEW - CompletionSummary, buildCompletionSummary, formatSummary*, OutputFormat)
  summary.test.ts      (NEW - unit tests)
  index.ts             (MODIFY - add summary exports)

src/cli/
  build-command.ts     (MODIFY - add --output flag, generate summary before exit)
  build-command.test.ts (MODIFY - add tests for --output flag and summary output)
```

### Project Structure Notes

- New files go in `src/output/` — follow kebab-case naming: `summary.ts`, `summary.test.ts`
- Tests co-located in same directory (no `__tests__/` folder)
- Barrel export from `src/output/index.ts`
- Cross-module imports use `@/` path alias with `.js` extension: `import { AppState } from '@/workspace/types.js'`
- Import `yaml` package directly: `import { stringify } from 'yaml'` (already a dependency)

### Architecture Compliance

- **Naming**: `CompletionSummary` (PascalCase type), `buildCompletionSummary` (camelCase function), `summary.ts` (kebab-case file)
- **No DI framework**: `buildCompletionSummary` takes `AppState` as parameter — pure function
- **Async pattern**: Format functions are synchronous (no I/O). Only build-command integration uses async for `stateManager.read()`
- **Output pattern**: Use `process.stdout.write()` — NOT `log()` from logger (same as status/cost commands)
- **ES modules**: `.js` extensions on all imports

### Testing Approach

- **Framework**: Vitest, co-located `.test.ts` files
- **Test files**: `src/output/summary.test.ts` and additions to `src/cli/build-command.test.ts`
- **Unit test pattern**: Create mock `AppState` objects, pass to `buildCompletionSummary()`, verify returned `CompletionSummary` shape and values
- **Format test pattern**: Pass `CompletionSummary` to each format function, verify output string
- **JSON validation**: `JSON.parse(formatSummaryJson(summary))` should not throw and match original data
- **YAML validation**: `yaml.parse(formatSummaryYaml(summary))` should not throw and match original data
- **Integration test pattern**: Mock `stateManager.read()`, verify `process.stdout.write()` is called with formatted summary
- **Test count baseline**: 252 tests passing (from story 5-2) — no regressions allowed

### Previous Story Learnings (from 5-1 and 5-2)

- `CostTracker.updateRunCostInState()` persists `totalCost` to `state.run.totalCost` — cost data IS available in state file when summary runs
- Story costs stored in `state.epics[epicKey].stories[storyKey].cost` as a single number
- Status and cost commands established the pattern of pure format functions + stdout output — follow same approach
- `formatStatusOutput()` and `formatCostOutput()` are pure functions accepting `AppState` — good pattern to follow
- The build command calls `stateManager.updateRun({ status: runStatus })` before exit — the summary must be generated AFTER this call so it has the final run status
- 252 tests passing at end of story 5-2 — no regressions allowed

### Anti-Patterns to Avoid

- Do NOT use `log()` or `logError()` for the summary — those add timestamps meant for build-time logging
- Do NOT modify `AppState` or `StoryState` types — work with what exists
- Do NOT add new dependencies — `yaml` is already available
- Do NOT store the summary in the state file — it's computed on the fly from state data
- Do NOT create a `Summary` class — pure functions are simpler and match the status/cost command pattern
- Do NOT put format logic in the CLI command file — keep it in `src/output/summary.ts` and import

### References

- [Source: docs/planning-artifacts/epics.md#Epic 5 - Story 5.3]
- [Source: docs/planning-artifacts/architecture.md#Project Structure - src/output/summary.ts]
- [Source: docs/planning-artifacts/architecture.md#Error Handling & Logging - Structured Logging]
- [Source: docs/planning-artifacts/architecture.md#CLI → Orchestrator Boundary]
- [Source: src/output/logger.ts - existing logger pattern]
- [Source: src/output/index.ts - current barrel exports]
- [Source: src/cli/build-command.ts - build command to modify]
- [Source: src/workspace/types.ts - AppState, StoryState, RunMeta types]
- [Source: src/errors/agent-error.ts - computeExitCode()]
- [Source: src/orchestrator/dispatcher.ts - DispatcherResult type]
- [Source: docs/implementation-artifacts/5-1-cost-tracker.md - previous story]
- [Source: docs/implementation-artifacts/5-2-status-cost-commands.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial test run failed: vi.mock for summary.js referenced variables not destructured from vi.hoisted — fixed by adding mockBuildCompletionSummary and mockFormatSummary to destructuring

### Completion Notes List

- Created `src/output/summary.ts` with `CompletionSummary`, `FailedStoryInfo`, `OutputFormat` types and pure functions: `buildCompletionSummary`, `formatSummaryText`, `formatSummaryJson`, `formatSummaryYaml`, `formatSummary`
- Added `--output <format>` flag to build command with validation (text/json/yaml, defaults to text)
- Build command now reads final state after `updateRun()`, builds summary, and writes formatted output to stdout before `process.exit()`
- Updated barrel exports in `src/output/index.ts`
- 15 unit tests for summary functions + 5 integration tests for build command `--output` flag
- All 272 tests pass (252 baseline + 20 new), zero regressions

### Change Log

- 2026-03-06: Implemented completion summary and output format support (Story 5.3)
- 2026-03-06: Code review fixes — added missing `completedAt` field to `CompletionSummary` interface and text output; normalized trailing newlines across all output formats; exported `FailedStoryInfo` type from barrel

### File List

- src/output/summary.ts (NEW)
- src/output/summary.test.ts (NEW)
- src/output/index.ts (MODIFIED)
- src/cli/build-command.ts (MODIFIED)
- src/cli/build-command.test.ts (MODIFIED)
