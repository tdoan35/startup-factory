# Story 4.2: Three-Tier Escalation Logic

Status: done

## Story

As a system,
I want to automatically retry, escalate to a more capable model, or flag for human attention based on error category,
So that failures are resolved autonomously when possible and flagged clearly when not.

## Acceptance Criteria

1. **Given** an agent fails with a Transient error (API timeout, rate limit)
   **When** the escalation logic evaluates the failure
   **Then** it retries with the same model tier and a fresh agent instance

2. **Given** an agent fails with a Capability error (agent couldn't complete the task)
   **When** the escalation logic evaluates the failure
   **Then** it escalates to the next model tier in the configured escalation order
   **And** the failure note from the previous attempt is included in the retry context

3. **Given** an agent fails with a Specification error (ambiguous or conflicting spec)
   **When** the escalation logic evaluates the failure
   **Then** it flags the story for human attention and sets status to `failed`
   **And** the failure note clearly describes the specification issue

4. **Given** a story has exhausted all retries and escalation tiers
   **When** the max attempts are reached
   **Then** the story is flagged for human attention with status `failed`
   **And** a structured log line is emitted indicating the story requires manual intervention

5. **Given** a story fails with a System error (orchestrator bug, file I/O error)
   **When** the escalation logic evaluates the failure
   **Then** the pipeline halts and reports the system error immediately

## Tasks / Subtasks

- [x] Task 1: Create `src/orchestrator/escalation.ts` — pure escalation decision function (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Define and export `EscalationDecision` union type (see Dev Notes for exact type definition). Export `evaluateEscalation(errorCategory: ErrorCategory, currentTier: number, attemptCount: number, models: ModelsConfig, maxAttempts: number): EscalationDecision`. Logic detailed in Dev Notes.
  - [x] 1.2: Create `src/orchestrator/escalation.test.ts` — pure unit tests (no filesystem I/O, no mocks needed). Cover all 5 decision paths: System→halt, Specification→flag, Transient under limit→retry same tier, Capability under limit with next tier→escalate, Transient/Capability at maxAttempts→flag, Capability with no next tier→flag. Verify returned `model` strings are correct. Use at least 12 test cases to thoroughly cover the decision matrix.

- [x] Task 2: Integrate escalation into `src/orchestrator/pipeline.ts` (AC: #1–#5)
  - [x] 2.1: Add `appConfig: AppConfig` to `PipelineOptions` interface (import `AppConfig` from `@/config/index.js`). Remove the hard-coded single-pass phase loop and replace with a per-phase retry loop (see Dev Notes for full algorithm). The loop: (a) initializes `storyAttempts = 0` and `currentTier = 0`; (b) for each phase, retries until success or halt/flag; (c) on each dispatch, increments `storyAttempts`, uses `currentModel` (derived from tier), runs agent; (d) on failure: writes failure note via `writeFailureNote`, evaluates escalation, updates state with `{ escalationTier: currentTier, failureNote, attempts: storyAttempts }`, then acts on decision; (e) on `retry`: reads failure notes via `readFailureNotes`, prepends to prompt, continues loop; (f) on `escalate`: updates `currentModel` and `currentTier`, reads failure notes, prepends to prompt, continues loop; (g) on `flag`: logs the flag message, updates state to `{ status: 'failed', ... }`, returns `'failed'`; (h) on `halt`: throws `AgentError` with `ErrorCategory.System`; (i) on success: breaks inner loop, resets escalation state for next phase.
  - [x] 2.2: Update `src/orchestrator/pipeline.test.ts` — add tests for: Transient error retries with same model; Capability error escalates to next model; Specification error flags immediately; System error throws; max-attempts exhaustion flags story; failure notes are read and passed to retry prompt; `escalationTier` and `failureNote` are updated in state on failure.

- [x] Task 3: Export from orchestrator index and run tests (AC: all)
  - [x] 3.1: Add to `src/orchestrator/index.ts`: `export { evaluateEscalation } from './escalation.js'` and `export type { EscalationDecision } from './escalation.js'`.
  - [x] 3.2: Run `npm test` — confirm all pre-existing tests plus new escalation tests pass with zero regressions. Report total test count and new test count.

## Dev Notes

### Architecture Placement

Per `docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure`:
- **New file:** `src/orchestrator/escalation.ts` — listed as `FR7-9: Three-tier escalation logic`
- **New file:** `src/orchestrator/escalation.test.ts` — co-located test file
- **Modify:** `src/orchestrator/pipeline.ts` — integrate escalation, failure notes, model override
- **Modify:** `src/orchestrator/pipeline.test.ts` — add escalation integration tests
- **Modify:** `src/orchestrator/index.ts` — add barrel exports for escalation

### Error Category → Escalation Mapping

From `docs/planning-artifacts/architecture.md#Error-Handling--Logging`:

| ErrorCategory | Action |
|--------------|--------|
| `Transient` | Retry same model tier (API timeout, rate limit, network error) |
| `Capability` | Escalate to next model tier in escalation order |
| `Specification` | Flag for human attention immediately |
| `System` | Halt pipeline immediately and report |
| Any (maxAttempts reached) | Flag for human attention |

### `EscalationDecision` Type (Exact Definition)

```typescript
// src/orchestrator/escalation.ts
import { ErrorCategory } from '@/errors/agent-error.js'
import type { ModelsConfig } from '@/config/types.js'

export type EscalationDecision =
  | { action: 'retry'; model: string }
  | { action: 'escalate'; model: string; tier: number }
  | { action: 'flag'; reason: string }
  | { action: 'halt'; reason: string }
```

### `evaluateEscalation` Logic (Exact Algorithm)

```typescript
export function evaluateEscalation(
  errorCategory: ErrorCategory,
  currentTier: number,   // 0-based; 0 = default model
  attemptCount: number,  // total dispatches made for this phase so far (already incremented before calling)
  models: ModelsConfig,  // { default: string, escalation: string[] }
  maxAttempts: number,   // from config.retry.maxAttempts
): EscalationDecision {
  // System errors always halt immediately regardless of attempt count
  if (errorCategory === ErrorCategory.System) {
    return { action: 'halt', reason: `System error encountered` }
  }

  // Specification errors always flag immediately regardless of attempt count
  if (errorCategory === ErrorCategory.Specification) {
    return { action: 'flag', reason: `Specification error: story requires human clarification` }
  }

  // Max attempts exhausted → flag
  if (attemptCount >= maxAttempts) {
    return { action: 'flag', reason: `Max attempts (${maxAttempts}) reached` }
  }

  // Build full tier array: [default, ...escalation]
  const allTiers = [models.default, ...models.escalation]

  if (errorCategory === ErrorCategory.Transient) {
    // Retry same tier
    return { action: 'retry', model: allTiers[currentTier] }
  }

  // Capability: try to escalate to next tier
  const nextTier = currentTier + 1
  if (nextTier < allTiers.length) {
    return { action: 'escalate', model: allTiers[nextTier], tier: nextTier }
  }

  // No more tiers to escalate to → flag
  return { action: 'flag', reason: `Capability error: all model tiers exhausted` }
}
```

### `pipeline.ts` Integration Algorithm

**New `PipelineOptions` interface addition:**
```typescript
import type { AppConfig } from '@/config/index.js'

export interface PipelineOptions {
  epicKey: string
  storyKey: string
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  appConfig: AppConfig   // NEW: required for escalation model tiers and maxAttempts
  log: (msg: string) => void
  logError: (msg: string) => void
}
```

**New imports needed in pipeline.ts:**
```typescript
import { evaluateEscalation } from './escalation.js'
import { writeFailureNote, readFailureNotes } from '@/workspace/index.js'
import { AgentError, ErrorCategory } from '@/errors/index.js'
import type { AppConfig } from '@/config/index.js'
```

**New per-phase retry loop structure (replaces the current for loop body):**

```typescript
export async function runStoryPipeline(opts: PipelineOptions): Promise<'completed' | 'failed'> {
  const { epicKey, storyKey, runner, stateManager, workspacePath, appConfig, log, logError } = opts

  await stateManager.updateStory(epicKey, storyKey, { status: 'in-progress', attempts: 1 })

  let cumulativeCost = 0
  let storyAttempts = 0         // total agent dispatches across all phases
  let currentTier = 0           // current model tier index (0 = default)
  const allTiers = [appConfig.models.default, ...appConfig.models.escalation]

  for (const { phase, config } of PHASES) {
    await stateManager.updateStory(epicKey, storyKey, { phase: phase as StoryPhase })

    let phaseSuccess = false

    while (!phaseSuccess) {
      storyAttempts++
      const currentModel = allTiers[currentTier] ?? config.model

      log(`Dispatching ${phase} agent for story ${epicKey}/${storyKey} (attempt ${storyAttempts}, tier ${currentTier})`)

      // Build prompt: include failure notes on retries
      const failureNotes = storyAttempts > 1 ? await readFailureNotes(workspacePath, storyKey) : []
      const rawPrompt = await readFile(config.promptPath, 'utf-8')
      const basePrompt = rawPrompt
        .replaceAll('{{workspacePath}}', workspacePath)
        .replaceAll('{epic}-{story}', storyKey)
      const systemPrompt = failureNotes.length > 0
        ? `${basePrompt}\n\n## Previous Failure Context\n\n${failureNotes.join('\n\n---\n\n')}`
        : basePrompt

      const result = await runner.run({
        model: currentModel,
        systemPrompt,
        allowedTools: config.allowedTools,
        workspacePath,
        prompt: buildPhasePrompt(phase, epicKey, storyKey),
      })

      cumulativeCost += result.cost.totalCostUsd
      await stateManager.updateStory(epicKey, storyKey, { cost: cumulativeCost, attempts: storyAttempts })

      if (!result.success) {
        // Write failure note
        const failureNotePath = await writeFailureNote(workspacePath, storyKey, storyAttempts, {
          errorCategory: result.errorCategory,
          errorMessage: result.output,
          modelTier: currentModel,
          phase,
          agentOutput: result.output,
        })

        await stateManager.updateStory(epicKey, storyKey, {
          failureNote: failureNotePath,
          escalationTier: currentTier,
        })

        logError(`Phase ${phase} failed for story ${epicKey}/${storyKey} (attempt ${storyAttempts}): ${result.errorCategory}`)

        const decision = evaluateEscalation(
          result.errorCategory,
          currentTier,
          storyAttempts,
          appConfig.models,
          appConfig.retry.maxAttempts,
        )

        if (decision.action === 'halt') {
          throw new AgentError(
            `System error in phase ${phase} for ${storyKey}: ${result.output}`,
            ErrorCategory.System,
            storyKey,
          )
        }

        if (decision.action === 'flag') {
          logError(`Story ${epicKey}/${storyKey} flagged for human attention: ${decision.reason}`)
          await stateManager.updateStory(epicKey, storyKey, {
            status: 'failed',
            phase: phase as StoryPhase,
          })
          return 'failed'
        }

        if (decision.action === 'escalate') {
          currentTier = decision.tier
          log(`Escalating story ${epicKey}/${storyKey} to model tier ${currentTier} (${decision.model})`)
        }
        // action === 'retry': currentTier unchanged, loop continues

        continue // retry the phase
      }

      // Phase succeeded
      if (phase === 'codeReview') {
        const reviewPath = join(workspacePath, 'stories', storyKey, 'review.md')
        const reviewContent = await readFile(reviewPath, 'utf-8').catch(() => result.output)
        if (reviewContent.includes('CHANGES REQUESTED')) {
          // Treat code review rejection as a Capability error
          storyAttempts++
          const failureNotePath = await writeFailureNote(workspacePath, storyKey, storyAttempts, {
            errorCategory: ErrorCategory.Capability,
            errorMessage: 'Code review requested changes',
            modelTier: currentModel,
            phase: 'codeReview',
            agentOutput: reviewContent,
          })
          await stateManager.updateStory(epicKey, storyKey, {
            failureNote: failureNotePath,
            escalationTier: currentTier,
            attempts: storyAttempts,
          })
          logError(`Code review requested changes for story ${epicKey}/${storyKey}`)

          const decision = evaluateEscalation(
            ErrorCategory.Capability,
            currentTier,
            storyAttempts,
            appConfig.models,
            appConfig.retry.maxAttempts,
          )

          if (decision.action === 'halt') {
            throw new AgentError(`System error in codeReview for ${storyKey}`, ErrorCategory.System, storyKey)
          }

          if (decision.action === 'flag') {
            logError(`Story ${epicKey}/${storyKey} flagged for human attention: ${decision.reason}`)
            await stateManager.updateStory(epicKey, storyKey, { status: 'failed', phase: 'codeReview' })
            return 'failed'
          }

          if (decision.action === 'escalate') {
            currentTier = decision.tier
            log(`Escalating story ${epicKey}/${storyKey} to model tier ${currentTier} (${decision.model})`)
          }
          continue // retry codeReview phase
        }
      }

      log(`Phase ${phase} completed for story ${epicKey}/${storyKey}`)
      phaseSuccess = true
    }
  }

  await stateManager.updateStory(epicKey, storyKey, { status: 'completed', phase: 'completed' })
  log(`Story ${epicKey}/${storyKey} completed successfully`)
  return 'completed'
}
```

**Important notes on the above:**
- The `continue` statement in the while loop retries the current phase
- `phaseSuccess = true` + the `while (!phaseSuccess)` loop structure replaces the old simple `if (!result.success)` check
- `storyAttempts` tracks the total number of agent dispatches across ALL phases (not per-phase)
- `currentTier` persists across phases (if a story needed to escalate to tier 1 during development, subsequent phases also use tier 1 unless reset explicitly — matching the state model where `escalationTier` is per-story)

### Callers of `runStoryPipeline` Must Pass `appConfig`

`src/orchestrator/dispatcher.ts` calls `runStoryPipeline`. It must be updated to pass `appConfig`:

**Current `DispatcherOptions`:**
```typescript
export interface DispatcherOptions {
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  log: (msg: string) => void
  logError: (msg: string) => void
}
```

**New `DispatcherOptions` (add `appConfig`):**
```typescript
import type { AppConfig } from '@/config/index.js'

export interface DispatcherOptions {
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  appConfig: AppConfig  // NEW
  log: (msg: string) => void
  logError: (msg: string) => void
}
```

And pass it through in `runDispatcher`:
```typescript
const outcome = await runStoryPipeline({
  epicKey,
  storyKey,
  runner,
  stateManager,
  workspacePath,
  appConfig,   // NEW
  log,
  logError,
})
```

**Also update `DispatcherOptions` export in `src/orchestrator/index.ts`** — the type is already re-exported, no extra change needed beyond the definition.

### Config Module Import

`AppConfig` is from `src/config/types.ts` but exported via `src/config/index.ts`. Use barrel import:
```typescript
import type { AppConfig } from '@/config/index.js'
```

Check `src/config/index.ts` to confirm `AppConfig` is exported (it should be based on prior stories). If not, add it.

### Model Tier Array

- Tier 0 = `appConfig.models.default` (e.g., `"claude-haiku-4-5-20251001"`)
- Tier 1 = `appConfig.models.escalation[0]` (e.g., `"claude-sonnet-4-6"`)
- Tier 2 = `appConfig.models.escalation[1]` (e.g., `"claude-opus-4-6"`)
- Formula: `const allTiers = [models.default, ...models.escalation]`

### Failure Note Format

`writeFailureNote` signature (from `src/workspace/failure-notes.ts`):
```typescript
writeFailureNote(
  workspacePath: string,
  storyKey: string,
  attemptNumber: number,  // must be >= 1 and unique (do NOT reuse attempt numbers)
  data: FailureNoteData
): Promise<string>  // returns file path
```

`FailureNoteData` fields:
```typescript
{
  errorCategory: string   // e.g., "Capability"
  errorMessage: string    // human-readable description
  modelTier: string       // model name used (e.g., "claude-haiku-4-5-20251001")
  phase: string           // pipeline phase (e.g., "development")
  agentOutput: string     // agent output before failure
}
```

**IMPORTANT:** `writeFailureNote` uses `flag: 'wx'` (exclusive create — fails if file exists). Since `storyAttempts` is a monotonically increasing counter starting at 1 across all retries, each call to `writeFailureNote` will have a unique `storyAttempts` value. Do NOT reset `storyAttempts` between phases.

### Failure Context in Retry Prompts

When retrying (action = 'retry' or 'escalate'), load previous failure notes and include them in the system prompt:

```typescript
const failureNotes = await readFailureNotes(workspacePath, storyKey)
if (failureNotes.length > 0) {
  systemPrompt += `\n\n## Previous Failure Context\n\n${failureNotes.join('\n\n---\n\n')}`
}
```

This satisfies AC #2: "the failure note from the previous attempt is included in the retry context."

### State Updates on Failure

When a phase fails, update:
- `failureNote`: path returned by `writeFailureNote` (last failure note path)
- `escalationTier`: current tier at time of failure
- `attempts`: `storyAttempts` (total dispatches so far)
- `cost`: cumulative cost so far

On flag/halt:
- `status: 'failed'`
- `phase`: the phase that failed

### Test Strategy for `escalation.test.ts`

Pure unit tests — no filesystem I/O, no async, no mocks. Just call `evaluateEscalation()` with various inputs and assert on the output.

```typescript
// Test matrix to cover:
// 1. System error → halt (any tier, any attempt count)
// 2. Specification error → flag (any tier, any attempt count)
// 3. Transient, attempt 1, maxAttempts 3 → retry same model
// 4. Transient, attempt 3, maxAttempts 3 → flag (exhausted)
// 5. Capability, tier 0, attempt 1, escalation=[tier1], maxAttempts 3 → escalate to tier 1
// 6. Capability, tier 1 (last tier), attempt 1, maxAttempts 3 → flag (no more tiers)
// 7. Capability, attempt 3, maxAttempts 3 → flag (exhausted, regardless of tier availability)
// 8. Transient, verify returned model is correct tier model
// 9. Escalate, verify returned tier number and model string
// 10. Max attempts check: attempt === maxAttempts → flag; attempt < maxAttempts → retry/escalate
```

### Test Strategy for `pipeline.test.ts` Additions

Use existing mock patterns from `src/orchestrator/pipeline.test.ts`. Mock `runner.run()` to return failure results with specific `errorCategory` values. Mock `writeFailureNote` and `readFailureNotes` (or spy on the module). Use a temp directory for workspacePath if real filesystem is needed. Test:
- Transient failure then success: model stays at tier 0, second dispatch succeeds
- Capability failure: second dispatch uses escalation model
- Specification failure: story returns 'failed', state updated correctly
- System error: function throws `AgentError`
- Max attempts: story returns 'failed' with correct log message
- Failure notes read on retry: system prompt includes failure context

### Patterns From Previous Stories (Must Follow Exactly)

From stories 3.4 and 4.1:
- **`node:` prefix** for all Node.js built-in imports
- **`.js` extension** on all relative imports within same directory
- **`@/` aliases** for cross-module imports (e.g., `@/config/index.js`, `@/errors/index.js`, `@/workspace/index.js`)
- **`import type`** for type-only imports
- **`async/await`** everywhere — no `.then().catch()` chains
- **camelCase** function names, **PascalCase** type names
- **kebab-case** file names

### Files to Modify

- `src/orchestrator/escalation.ts` — **new file**
- `src/orchestrator/escalation.test.ts` — **new file**
- `src/orchestrator/pipeline.ts` — **modify** (add `appConfig`, wrap phases in retry loop)
- `src/orchestrator/pipeline.test.ts` — **modify** (add escalation tests, pass `appConfig` to existing tests)
- `src/orchestrator/dispatcher.ts` — **modify** (add `appConfig` to `DispatcherOptions`, pass through)
- `src/orchestrator/dispatcher.test.ts` — **modify** (pass `appConfig` to existing test fixtures)
- `src/orchestrator/index.ts` — **modify** (add escalation exports)

### Files NOT to Touch

- `src/workspace/failure-notes.ts` — already complete, no changes needed
- `src/workspace/types.ts` — `escalationTier` and `failureNote` fields already exist
- `src/workspace/state-manager.ts` — no changes needed
- `src/errors/agent-error.ts` — `ErrorCategory` already has all 4 categories
- `src/config/types.ts` — `AppConfig` already has `models.escalation` and `retry.maxAttempts`
- `src/agents/**` — no agent config changes in this story
- `src/cli/**` — no CLI changes in this story

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.2] — Exact AC text for all 5 ACs (FR7, FR8, FR9)
- [Source: docs/planning-artifacts/architecture.md#Error-Handling--Logging] — Error categorization table mapping category → orchestrator response
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/orchestrator/escalation.ts` confirmed file path
- [Source: docs/planning-artifacts/architecture.md#State-File-Architecture] — `escalationTier` and `failureNote` fields in StoryState schema
- [Source: src/orchestrator/pipeline.ts] — Current pipeline implementation to modify
- [Source: src/orchestrator/dispatcher.ts] — Dispatcher that calls pipeline (needs `appConfig` threaded through)
- [Source: src/workspace/failure-notes.ts] — `writeFailureNote` and `readFailureNotes` implementations
- [Source: src/workspace/types.ts] — `StoryState` with `escalationTier?: number` and `failureNote?: string`
- [Source: src/config/types.ts] — `AppConfig.models.escalation: string[]` and `AppConfig.retry.maxAttempts: number`
- [Source: src/errors/agent-error.ts] — `ErrorCategory` enum (Transient, Capability, Specification, System)
- [Source: src/agents/types.ts] — `AgentResult` union type with `errorCategory: ErrorCategory` on failure
- [Source: docs/implementation-artifacts/4-1-failure-notes-module.md#Integration-Context] — "Story 4.2 will call writeFailureNote after each failed agent run and readFailureNotes when building context for a retry agent dispatch"
- [Source: docs/implementation-artifacts/4-1-failure-notes-module.md#Completion-Notes-List] — 171 tests currently passing; confirm no regressions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `evaluateEscalation` as a pure function in `src/orchestrator/escalation.ts` following the exact algorithm from Dev Notes. All 5 ACs covered: System→halt, Specification→flag, Transient→retry same tier, Capability→escalate to next tier, exhaustion→flag.
- Created 13 unit tests in `escalation.test.ts` covering all decision paths (System/Specification overrides, maxAttempts boundary, Transient retry with correct model, Capability escalation with correct tier/model, no-escalation-tiers flag). All pure — no mocks, no async.
- Replaced the single-pass phase loop in `pipeline.ts` with a per-phase `while (!phaseSuccess)` retry loop. Added `storyAttempts` counter (monotonically increasing across all phases), `currentTier` tracker, failure note writes via `writeFailureNote`, failure context injection in system prompts via `readFailureNotes`, and escalation decision routing (`retry`/`escalate`/`flag`/`halt`). CHANGES REQUESTED in code review handled as Capability escalation.
- Added 7 new integration tests in `pipeline.test.ts`: Transient retry stays on same model, Capability escalates to next model, Specification flags immediately, System error throws `AgentError`, max-attempts exhaustion flags, failure notes included in retry prompt, `escalationTier`/`failureNote` state updated on failure.
- Added `appConfig: AppConfig` to `DispatcherOptions` in `dispatcher.ts` and threaded it through to `runStoryPipeline`. Updated `dispatcher.test.ts` baseOpts accordingly.
- Added escalation barrel exports to `src/orchestrator/index.ts`.
- Total tests: 191 (was 171, +20 new). Zero regressions.

### File List

- src/orchestrator/escalation.ts (new)
- src/orchestrator/escalation.test.ts (new)
- src/orchestrator/pipeline.ts (modified)
- src/orchestrator/pipeline.test.ts (modified)
- src/orchestrator/dispatcher.ts (modified)
- src/orchestrator/dispatcher.test.ts (modified)
- src/orchestrator/index.ts (modified)

## Change Log

- 2026-03-06: Story created with comprehensive implementation context for three-tier escalation logic
- 2026-03-06: Implemented three-tier escalation logic — new escalation.ts module, pipeline retry loop, dispatcher appConfig threading. 191 tests passing (+20 new).
- 2026-03-06: Code review fixes — H1: replaced global `storyAttempts > 1` check with per-phase `phaseAttempts` counter to prevent cross-phase failure note bleed; M1: removed double `storyAttempts++` in CHANGES REQUESTED path; M3: added logError before re-throwing AgentError in dispatcher; M4: consolidated two-call failure state update into single `updateStory` call. Added 1 new test (CHANGES REQUESTED with escalation tiers). 192 tests passing.
- 2026-03-06: Code review fixes (round 2) — H1: added dispatcher system error propagation test (catch/rethrow path was untested); M1: CHANGES REQUESTED now restarts from development phase (not just codeReview) so developer can fix issues before re-review — converted for-loop to while-loop with explicit phaseIndex; added `forceLoadNotes` flag so development re-run receives review failure notes; M2: added test for CHANGES REQUESTED exhausting maxAttempts; M3: fixed escalation.ts to import ErrorCategory from @/errors/index.js barrel (was importing directly from @/errors/agent-error.js); M4: removed misleading `?? config.model` dead-code fallback in currentModel assignment. 194 tests passing (+2 new).
