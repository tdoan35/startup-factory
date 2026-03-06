# Story 5.1: Cost Tracker

Status: done

## Story

As a system,
I want to log token usage and estimated cost for every agent run and tally cumulative costs,
So that cost data is always available in the state file for reporting.

## Acceptance Criteria

1. **Given** an agent run completes (success or failure)
   **When** the cost tracker processes the AgentResult
   **Then** it records: input tokens, output tokens, model tier, and estimated cost for that agent run

2. **Given** cost data for individual agent runs within a story
   **When** the cost tracker tallies story cost
   **Then** it sums all agent run costs for that story and stores the total in the state file under the story entry

3. **Given** cost data for all stories in a run
   **When** the run completes or status is requested
   **Then** the total run cost is computed by summing all story costs
   **And** the total is stored in the run-level metadata of the state file

## Tasks / Subtasks

- [x] Task 1: Create `src/cost/types.ts` with CostEntry and CostSummary types (AC: #1)
  - [x] Define `CostEntry` interface: `{ inputTokens, outputTokens, modelUsed, totalCostUsd }`
  - [x] Define `StoryCostSummary` interface: `{ storyKey, entries: CostEntry[], totalCostUsd }`
  - [x] Define `CostSummary` interface: `{ stories: StoryCostSummary[], totalCostUsd }`

- [x] Task 2: Create `src/cost/cost-tracker.ts` with CostTracker class (AC: #1, #2, #3)
  - [x] `record(storyKey: string, cost: AgentCostData): void` — in-memory per-run recording
  - [x] `getStoryCost(storyKey: string): number` — sum all entries for a story
  - [x] `getTotalCost(): number` — sum all story costs
  - [x] `getSummary(): CostSummary` — full breakdown for CLI reporting
  - [x] `updateStoryCostInState(epicKey, storyKey, stateManager): Promise<void>` — write story total to state
  - [x] `updateRunCostInState(stateManager): Promise<void>` — write run total to state

- [x] Task 3: Update `src/cost/index.ts` to export CostTracker and types (AC: #1)

- [x] Task 4: Integrate CostTracker into `src/orchestrator/pipeline.ts` (AC: #1, #2)
  - [x] Add `costTracker: CostTracker` to `PipelineOptions` interface
  - [x] Replace `cumulativeCost += result.cost.totalCostUsd` with `costTracker.record(storyKey, result.cost)`
  - [x] Replace all `updateStory({ cost: cumulativeCost })` with `costTracker.updateStoryCostInState(epicKey, storyKey, stateManager)`
  - [x] Remove the `cumulativeCost` local variable

- [x] Task 5: Integrate CostTracker into `src/orchestrator/dispatcher.ts` (AC: #3)
  - [x] Create a single `CostTracker` instance at the top of `runDispatcher`
  - [x] Pass `costTracker` in the `runStoryPipeline` call options
  - [x] After the dispatcher loop completes, call `await costTracker.updateRunCostInState(stateManager)`

- [x] Task 6: Create `src/cost/cost-tracker.test.ts` with unit tests (AC: #1, #2, #3)
  - [x] Test `record()` stores entries per story key
  - [x] Test `getStoryCost()` sums correctly for multi-run story
  - [x] Test `getTotalCost()` sums across all stories
  - [x] Test `getSummary()` returns correct CostSummary shape
  - [x] Test `updateStoryCostInState()` calls `stateManager.updateStory` with correct args (mock stateManager)
  - [x] Test `updateRunCostInState()` calls `stateManager.updateRun` with correct totalCost (mock stateManager)

## Dev Notes

### Critical: What Already Exists

**DO NOT reinvent cost accumulation** — the pipeline already accumulates cost. You are replacing the raw accumulation with a proper CostTracker abstraction.

**`src/agents/types.ts`** — `AgentCostData` is already defined:
```typescript
export interface AgentCostData {
  inputTokens: number
  outputTokens: number
  totalCostUsd: number
  modelUsed: string
}
```
`CostEntry` in `src/cost/types.ts` should have the **exact same shape** (just aliased/re-exported or duplicated for module separation). Do NOT import from `@/agents` in `@/cost` to avoid circular deps — re-define in cost/types.ts.

**`src/workspace/types.ts`** — `StoryState` has `cost: number`. The `updateStory()` call in StateManager accepts `Partial<StoryState>`, so you write `cost` as a single number (the story total). Do NOT add new fields to `StoryState` — that's out of scope and would require changing workspace types (Epic 2 work).

**`src/workspace/state-manager.ts`** — already has:
- `updateStory(epicKey, storyKey, Partial<StoryState>)` — use for story cost updates
- `updateRun(Partial<RunMeta>)` — use for `totalCost` update
- `RunMeta.totalCost: number` field exists and is initialized to 0 — it's never updated today (this story fixes that)

**`src/orchestrator/pipeline.ts`** — currently manages cost manually:
```typescript
let cumulativeCost = 0
// ...
cumulativeCost += result.cost.totalCostUsd
// ...
await stateManager.updateStory(epicKey, storyKey, { cost: cumulativeCost, ... })
```
This pattern appears in **3 locations** in pipeline.ts (success path, failure path, CHANGES REQUESTED path). All three must use `costTracker.record()` + `costTracker.updateStoryCostInState()` instead.

### Integration Pattern for pipeline.ts

```typescript
// PipelineOptions — add:
import type { CostTracker } from '@/cost/index.js'
// ...
export interface PipelineOptions {
  // ...existing fields...
  costTracker: CostTracker
}

// In runStoryPipeline body — REMOVE:
// let cumulativeCost = 0

// REPLACE every:
//   cumulativeCost += result.cost.totalCostUsd
// WITH:
//   costTracker.record(storyKey, result.cost)

// REPLACE every:
//   await stateManager.updateStory(epicKey, storyKey, { cost: cumulativeCost, ...otherFields })
// WITH:
//   await costTracker.updateStoryCostInState(epicKey, storyKey, stateManager)
//   await stateManager.updateStory(epicKey, storyKey, { ...otherFields })
// OR combine as:
//   await stateManager.updateStory(epicKey, storyKey, {
//     cost: costTracker.getStoryCost(storyKey),
//     ...otherFields
//   })
```

Note: There are 4 `updateStory` calls that include `cost` in pipeline.ts (failure path, CHANGES REQUESTED path x2, success path). Verify each one after refactoring.

### Integration Pattern for dispatcher.ts

```typescript
import { CostTracker } from '@/cost/index.js'

export async function runDispatcher(opts: DispatcherOptions): Promise<DispatcherResult> {
  const costTracker = new CostTracker()
  // ...
  // Inside the while loop, pass costTracker to runStoryPipeline:
  outcome = await runStoryPipeline({
    // ...existing options...
    costTracker,
  })
  // ...
  // After the while loop, before returning:
  await costTracker.updateRunCostInState(stateManager)
  return { completedCount, failedCount }
}
```

### CostTracker Internal Storage

Use a `Map<string, CostEntry[]>` keyed by `storyKey`. Each `record()` call appends to the array.

```typescript
export class CostTracker {
  private readonly entries = new Map<string, CostEntry[]>()

  record(storyKey: string, cost: CostEntry): void {
    const list = this.entries.get(storyKey) ?? []
    list.push({ ...cost })
    this.entries.set(storyKey, list)
  }
  // ...
}
```

### File Structure

```
src/cost/
  index.ts          (update from stub export {} to real exports)
  types.ts          (NEW)
  cost-tracker.ts   (NEW)
  cost-tracker.test.ts (NEW)
```

### Project Structure Notes

- Module location: `src/cost/` — already exists as stub
- Follow kebab-case file names: `cost-tracker.ts`, `cost-tracker.test.ts`, `types.ts`
- Barrel pattern: `src/cost/index.ts` must export `CostTracker` and all types
- Import path: `@/cost/index.js` (note `.js` extension for ES modules even from `.ts` files)
- Tests are co-located: `cost-tracker.test.ts` in same directory as `cost-tracker.ts`
- NO separate `__tests__/` folder
- Cross-module imports use path aliases: `@/workspace/state-manager.js`, `@/agents/types.js`

### Architecture Compliance

- **Naming:** `CostTracker` (PascalCase class), `CostEntry` (PascalCase type), `costTracker` (camelCase variable)
- **No DI framework:** Pass dependencies (stateManager) as function parameters
- **Async pattern:** `async/await` only — no `.then()`/`.catch()` chains
- **No typed error classes needed** for this story — CostTracker errors propagate naturally from StateManager
- **ES modules:** All imports must use `.js` extension: `import type { StateManager } from '@/workspace/state-manager.js'`

### Testing Approach

Use Vitest. Mock `StateManager` using `vi.fn()`:
```typescript
const mockStateManager = {
  updateStory: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
} as unknown as StateManager
```

Test `updateStoryCostInState` verifies `mockStateManager.updateStory` was called with:
- correct `epicKey`, `storyKey`
- `updates` containing `cost` equal to `getStoryCost(storyKey)` result

Test `updateRunCostInState` verifies `mockStateManager.updateRun` was called with `{ totalCost: X }`.

### References

- Story 5.1 requirements: [Source: docs/planning-artifacts/epics.md#Epic-5-Story-5.1]
- FR32-33 coverage: [Source: docs/planning-artifacts/epics.md#FR-Coverage-Map]
- AgentCostData type: [Source: src/agents/types.ts]
- StoryState/RunMeta types: [Source: src/workspace/types.ts]
- StateManager API: [Source: src/workspace/state-manager.ts]
- Pipeline cost accumulation (to replace): [Source: src/orchestrator/pipeline.ts#L55, L111, L123, L188, L222]
- Dispatcher integration point: [Source: src/orchestrator/dispatcher.ts]
- Architecture cost module spec: [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- Naming conventions: [Source: docs/planning-artifacts/architecture.md#Naming-Patterns]
- Process patterns (async, DI): [Source: docs/planning-artifacts/architecture.md#Process-Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `CostTracker` class with `Map<string, CostEntry[]>` internal storage, keyed by storyKey
- Replaced manual `cumulativeCost` accumulation in `pipeline.ts` (3 locations) with `costTracker.record()` + `costTracker.getStoryCost()`
- Integrated `CostTracker` into `dispatcher.ts`: instantiated once per run, passed into each `runStoryPipeline` call, and `updateRunCostInState()` called after the loop to write final totalCost to state
- Updated existing `dispatcher.test.ts` and `pipeline.test.ts` mocks to include the new `updateRun` and `costTracker` dependencies
- All 223 tests pass with no regressions
- Code review fixes: removed dead `updateStoryCostInState()` method (pipeline inlines cost to avoid two-call inconsistency window); fixed `getSummary()` double-iteration; added dispatcher tests verifying `updateRun` is called (AC #3 coverage); added pipeline tests verifying `record()` and cost propagation (AC #1/#2 integration coverage). 227 tests passing.

### File List

- src/cost/types.ts (new)
- src/cost/cost-tracker.ts (new)
- src/cost/cost-tracker.test.ts (new)
- src/cost/index.ts (modified)
- src/orchestrator/pipeline.ts (modified)
- src/orchestrator/dispatcher.ts (modified)
- src/orchestrator/dispatcher.test.ts (modified)
- src/orchestrator/pipeline.test.ts (modified)
