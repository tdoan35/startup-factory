# Story 3.1: AgentRunner Interface & Claude Agent Runner Implementation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want a provider-agnostic agent execution layer backed by the Claude Agent SDK,
so that agents can be dispatched uniformly and the provider can be swapped in the future.

## Acceptance Criteria

1. **Given** the AgentRunner interface is defined, **When** a component needs to dispatch an agent, **Then** it calls `AgentRunner.run(config: AgentConfig)` and receives a `Promise<AgentResult>` **And** the interface defines `AgentConfig` (model, system prompt, tool permissions, workspace path) and `AgentResult` (success/failure, output, cost data, error category if failed).

2. **Given** the ClaudeAgentRunner implementation, **When** `run()` is called with an `AgentConfig`, **Then** it creates a Claude Agent SDK session with the specified model, system prompt, and tool permissions **And** the agent executes with access to built-in tools (Read, Write, Edit, Bash, Glob, Grep) as configured.

3. **Given** an agent run completes successfully, **When** the AgentResult is returned, **Then** it includes token usage (input tokens, output tokens), model tier used, and estimated cost in USD.

4. **Given** an API error occurs (rate limit, timeout, network error), **When** the ClaudeAgentRunner catches it, **Then** it returns an AgentResult with `success: false` and `errorCategory: ErrorCategory.Transient`.

## Tasks / Subtasks

- [x] Task 1: Create `src/agents/types.ts` with `AgentConfig` and `AgentResult` types (AC: #1)
  - [x] 1.1: Define and export `AgentConfig` interface: `{ model: string; systemPrompt: string; allowedTools: string[]; workspacePath: string; prompt: string }`
  - [x] 1.2: Define and export `AgentCostData` interface: `{ inputTokens: number; outputTokens: number; totalCostUsd: number; modelUsed: string }`
  - [x] 1.3: Define and export `AgentResult` type as discriminated union:
    - Success: `{ success: true; output: string; cost: AgentCostData }`
    - Failure: `{ success: false; output: string; cost: AgentCostData; errorCategory: ErrorCategory }`

- [x] Task 2: Create `src/agents/agent-runner.ts` with the `AgentRunner` interface (AC: #1)
  - [x] 2.1: Define and export `AgentRunner` interface with single method: `run(config: AgentConfig): Promise<AgentResult>`
  - [x] 2.2: This interface is the only contract the orchestrator will ever depend on — keep it minimal

- [x] Task 3: Create `src/agents/claude-agent-runner.ts` implementing `AgentRunner` (AC: #2, #3, #4)
  - [x] 3.1: Export `ClaudeAgentRunner` class implementing `AgentRunner`
  - [x] 3.2: Implement `run(config: AgentConfig): Promise<AgentResult>` using `query()` from `@anthropic-ai/claude-agent-sdk`
  - [x] 3.3: Pass `options.model`, `options.systemPrompt` (string), `options.allowedTools`, `options.cwd` from `AgentConfig`
  - [x] 3.4: Set `options.permissionMode = 'bypassPermissions'` and `options.allowDangerouslySkipPermissions = true` for non-interactive batch execution
  - [x] 3.5: Set `options.persistSession = false` — ephemeral sessions, no state to disk
  - [x] 3.6: Iterate the `Query` async generator; collect the `SDKResultMessage` (type: `'result'`)
  - [x] 3.7: On `SDKResultSuccess` (`is_error: false`, `subtype: 'success'`): return success AgentResult with output string, cost data from `total_cost_usd` and `usage`
  - [x] 3.8: On `SDKResultError` (subtype: `'error_during_execution'` | `'error_max_turns'` | `'error_max_budget_usd'`): map to `ErrorCategory.Capability` and return failure AgentResult
  - [x] 3.9: Wrap entire `run()` in try/catch for thrown exceptions (network errors, auth failures, process spawn failures): return failure AgentResult with `ErrorCategory.Transient`
  - [x] 3.10: Extract `modelUsed` from `result.modelUsage` (first key in the Record) or fall back to `config.model`

- [x] Task 4: Update `src/agents/index.ts` barrel exports (AC: all)
  - [x] 4.1: Export `AgentRunner` interface from `./agent-runner.js`
  - [x] 4.2: Export `ClaudeAgentRunner` class from `./claude-agent-runner.js`
  - [x] 4.3: Export types `AgentConfig`, `AgentResult`, `AgentCostData` from `./types.js`

- [x] Task 5: Write co-located tests in `src/agents/agent-runner.test.ts` and `src/agents/claude-agent-runner.test.ts` (AC: #1, #2, #3, #4)
  - [x] 5.1: In `agent-runner.test.ts`: verify `AgentRunner` interface shape can be implemented (use a mock class)
  - [x] 5.2: In `claude-agent-runner.test.ts`: mock `query` from `@anthropic-ai/claude-agent-sdk` using `vi.mock()`
  - [x] 5.3: Test success path: mock returns a valid `SDKResultSuccess` message — verify `AgentResult.success === true`, cost fields populated, output string extracted
  - [x] 5.4: Test `SDKResultError` with `subtype: 'error_during_execution'` — verify `errorCategory === ErrorCategory.Capability`
  - [x] 5.5: Test `SDKResultError` with `subtype: 'error_max_turns'` — verify `errorCategory === ErrorCategory.Capability`
  - [x] 5.6: Test thrown exception (simulate network error) — verify `errorCategory === ErrorCategory.Transient`
  - [x] 5.7: Verify `options.permissionMode === 'bypassPermissions'` is passed to `query()`
  - [x] 5.8: Verify `options.persistSession === false` is passed to `query()`
  - [x] 5.9: Run `npm test` to confirm all 100 pre-existing tests still pass with new tests added

## Dev Notes

### Architecture Requirements

**New files to CREATE:**
```
src/agents/types.ts                   # AgentConfig, AgentResult, AgentCostData types
src/agents/agent-runner.ts            # AgentRunner interface (1 method)
src/agents/agent-runner.test.ts       # Interface contract test
src/agents/claude-agent-runner.ts     # ClaudeAgentRunner implementation
src/agents/claude-agent-runner.test.ts # Mocked SDK tests
```

**File to MODIFY:**
```
src/agents/index.ts                   # Currently `export {}` — add all exports
```

**Files NOT to touch:**
- `src/orchestrator/` — Epic 3 Stories 3.2-3.4 territory
- `src/agents/story-creator/`, `developer/`, `code-reviewer/`, `qa/` — Stories 3.2-3.3 territory
- `src/workspace/` — Done in Epic 2, no changes
- `src/errors/` — Done in Epic 1, no changes
- `src/config/`, `src/cli/`, `src/cost/`, `src/output/` — Other epics

**Module location:** `src/agents/` per architecture doc. The `AgentRunner` interface and `ClaudeAgentRunner` class are the core of this module. Agent-specific configs (story-creator, developer, etc.) are deferred to Story 3.2.

### Type Definitions

Full type definitions for `src/agents/types.ts`:

```typescript
import type { ErrorCategory } from '@/errors/agent-error.js'

export interface AgentConfig {
  model: string            // e.g., 'claude-sonnet-4-6', 'claude-opus-4-6'
  systemPrompt: string     // Loaded from prompt.md at call site, passed as string here
  allowedTools: string[]   // e.g., ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
  workspacePath: string    // Absolute path to .startup-factory/ — used as cwd for agent
  prompt: string           // The task prompt sent to the agent (first user message)
}

export interface AgentCostData {
  inputTokens: number
  outputTokens: number
  totalCostUsd: number
  modelUsed: string        // Actual model ID from SDK result (may differ if fallback used)
}

export type AgentResult =
  | { success: true; output: string; cost: AgentCostData }
  | { success: false; output: string; cost: AgentCostData; errorCategory: ErrorCategory }
```

### AgentRunner Interface

```typescript
// src/agents/agent-runner.ts
import type { AgentConfig } from './types.js'
import type { AgentResult } from './types.js'

export interface AgentRunner {
  run(config: AgentConfig): Promise<AgentResult>
}
```

### ClaudeAgentRunner Implementation

The Claude Agent SDK `query()` function is the entry point. It is an **async generator** — you must iterate through it to get the result.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import { ErrorCategory } from '@/errors/agent-error.js'
import type { AgentRunner } from './agent-runner.js'
import type { AgentConfig, AgentResult } from './types.js'

export class ClaudeAgentRunner implements AgentRunner {
  async run(config: AgentConfig): Promise<AgentResult> {
    const zeroCost = { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: config.model }

    try {
      const q = query({
        prompt: config.prompt,
        options: {
          model: config.model,
          systemPrompt: config.systemPrompt,
          allowedTools: config.allowedTools,
          cwd: config.workspacePath,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          persistSession: false,
        },
      })

      let resultMessage: SDKResultMessage | undefined

      for await (const message of q) {
        if (message.type === 'result') {
          resultMessage = message as SDKResultMessage
          break
        }
      }

      if (!resultMessage) {
        return { success: false, output: 'No result message received from agent', cost: zeroCost, errorCategory: ErrorCategory.System }
      }

      const cost = {
        inputTokens: resultMessage.usage.input_tokens,
        outputTokens: resultMessage.usage.output_tokens,
        totalCostUsd: resultMessage.total_cost_usd,
        modelUsed: Object.keys(resultMessage.modelUsage)[0] ?? config.model,
      }

      if (resultMessage.subtype === 'success' && !resultMessage.is_error) {
        return { success: true, output: resultMessage.result, cost }
      }

      // SDKResultError — map subtype to ErrorCategory
      const errorSubtype = (resultMessage as SDKResultError).subtype
      const errorCategory =
        errorSubtype === 'error_during_execution' || errorSubtype === 'error_max_turns'
          ? ErrorCategory.Capability
          : ErrorCategory.System
      const errorOutput = (resultMessage as SDKResultError).errors?.join('\n') ?? 'Agent run failed'
      return { success: false, output: errorOutput, cost, errorCategory }

    } catch (err: unknown) {
      // Network errors, auth failures, spawn failures — all Transient
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: message, cost: zeroCost, errorCategory: ErrorCategory.Transient }
    }
  }
}
```

**Import note:** Import only `query` from the SDK. Also import the necessary types:
```typescript
import type { SDKResultMessage, SDKResultError } from '@anthropic-ai/claude-agent-sdk'
```
But check whether these are exported from the package. If not, use type inference from the iterated messages.

### Claude Agent SDK Key Facts (v0.2.70)

- **Import:** `import { query } from '@anthropic-ai/claude-agent-sdk'`
- **Type imports:** `import type { SDKResultMessage, SDKResultError, SDKResultSuccess, Options } from '@anthropic-ai/claude-agent-sdk'`
- **`query()` signature:** `query({ prompt: string, options?: Options }): Query` where `Query extends AsyncGenerator<SDKMessage, void>`
- **Iteration pattern:** `for await (const message of queryResult) { if (message.type === 'result') { ... } }`
- **Result message types:** `SDKResultSuccess` (subtype: `'success'`, `is_error: false`) and `SDKResultError` (subtype: `'error_during_execution'` | `'error_max_turns'` | `'error_max_budget_usd'`)
- **Cost data:** `result.total_cost_usd` (number), `result.usage.input_tokens`, `result.usage.output_tokens`
- **Model used:** `result.modelUsage` is `Record<string, ModelUsage>` — first key is the primary model ID
- **`options.tools`:** Takes `string[]` for named tools OR `{ type: 'preset', preset: 'claude_code' }` for all Claude Code tools
- **`options.allowedTools`:** Alternative to `tools` — auto-approves listed tools without permission prompts
- **`options.systemPrompt`:** `string` | `{ type: 'preset', preset: 'claude_code', append?: string }` — use plain string for custom system prompts
- **`options.cwd`:** Sets the working directory for the agent session (use `workspacePath`)
- **`options.permissionMode: 'bypassPermissions'`** + **`options.allowDangerouslySkipPermissions: true`**: Required for non-interactive/automated use — skip all permission prompts
- **`options.persistSession: false`**: Do not save session to `~/.claude/projects/` — ephemeral runs

### Error Mapping

| Scenario | SDK Signal | ErrorCategory |
|----------|-----------|---------------|
| Thrown exception (network, auth, spawn) | `catch` block | `Transient` |
| `SDKResultError.subtype === 'error_during_execution'` | Agent runtime error | `Capability` |
| `SDKResultError.subtype === 'error_max_turns'` | Agent ran too long | `Capability` |
| `SDKResultError.subtype === 'error_max_budget_usd'` | Cost limit hit | `System` |
| `SDKResultSuccess.is_error === true` | Not expected in MVP | `Capability` (safe fallback) |
| No result message received | Generator exhausted | `System` |

### Testing Pattern

The `query` function must be mocked at the module level. It returns an async generator, so the mock must too.

```typescript
// src/agents/claude-agent-runner.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk'
import { ClaudeAgentRunner } from './claude-agent-runner.js'
import { ErrorCategory } from '@/errors/agent-error.js'
import type { AgentConfig } from './types.js'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

import { query } from '@anthropic-ai/claude-agent-sdk'
const mockQuery = vi.mocked(query)

const TEST_CONFIG: AgentConfig = {
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You are a developer agent.',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  workspacePath: '/tmp/test-workspace',
  prompt: 'Implement story 1-1.',
}

function mockSuccessResult(overrides?: Partial<SDKResultSuccess>): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'Task completed successfully.',
    duration_ms: 5000,
    duration_api_ms: 4800,
    num_turns: 3,
    stop_reason: 'end_turn',
    total_cost_usd: 0.042,
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    modelUsage: { 'claude-sonnet-4-6': { input_tokens: 1000, output_tokens: 500 } },
    permission_denials: [],
    uuid: '00000000-0000-0000-0000-000000000001' as any,
    session_id: 'test-session-1',
    ...overrides,
  }
}

async function* makeGenerator(messages: any[]) {
  for (const msg of messages) yield msg
}

describe('ClaudeAgentRunner', () => {
  let runner: ClaudeAgentRunner

  beforeEach(() => {
    runner = new ClaudeAgentRunner()
    vi.clearAllMocks()
  })

  it('returns success AgentResult on SDKResultSuccess', async () => {
    mockQuery.mockReturnValue(makeGenerator([mockSuccessResult()]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toBe('Task completed successfully.')
      expect(result.cost.totalCostUsd).toBe(0.042)
      expect(result.cost.inputTokens).toBe(1000)
      expect(result.cost.outputTokens).toBe(500)
      expect(result.cost.modelUsed).toBe('claude-sonnet-4-6')
    }
  })

  it('passes bypassPermissions and persistSession=false to query()', async () => {
    mockQuery.mockReturnValue(makeGenerator([mockSuccessResult()]) as any)
    await runner.run(TEST_CONFIG)
    expect(mockQuery).toHaveBeenCalledWith({
      prompt: TEST_CONFIG.prompt,
      options: expect.objectContaining({
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
      }),
    })
  })

  it('maps error_during_execution to ErrorCategory.Capability', async () => {
    const errResult: SDKResultError = {
      type: 'result', subtype: 'error_during_execution', is_error: true,
      duration_ms: 1000, duration_api_ms: 900, num_turns: 1, stop_reason: null,
      total_cost_usd: 0.001, usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {}, permission_denials: [], errors: ['Agent failed to complete task.'],
      uuid: '00000000-0000-0000-0000-000000000002' as any, session_id: 'test-session-2',
    }
    mockQuery.mockReturnValue(makeGenerator([errResult]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Capability)
    }
  })

  it('maps error_max_turns to ErrorCategory.Capability', async () => {
    const errResult: SDKResultError = {
      type: 'result', subtype: 'error_max_turns', is_error: true,
      duration_ms: 1000, duration_api_ms: 900, num_turns: 100, stop_reason: 'max_turns',
      total_cost_usd: 0.5, usage: { input_tokens: 5000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {}, permission_denials: [], errors: ['Max turns exceeded.'],
      uuid: '00000000-0000-0000-0000-000000000003' as any, session_id: 'test-session-3',
    }
    mockQuery.mockReturnValue(makeGenerator([errResult]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Capability)
    }
  })

  it('maps thrown exception to ErrorCategory.Transient', async () => {
    mockQuery.mockImplementation(() => { throw new Error('ECONNREFUSED') })
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Transient)
    }
  })
})
```

### Project Structure Notes

- **`src/agents/types.ts`** — must be created; `AgentConfig.allowedTools` matches SDK `options.allowedTools` directly so no transformation needed
- **`src/agents/agent-runner.ts`** — pure interface, no imports except types; this is the dependency inversion point
- **`src/agents/claude-agent-runner.ts`** — only file that imports from `@anthropic-ai/claude-agent-sdk`; keeps SDK dependency isolated
- **No DI framework** — `ClaudeAgentRunner` is instantiated directly; the orchestrator will receive it as a constructor parameter
- **`node:` prefix** — no Node built-in imports in this story (all deps are from SDK and local modules); follow the convention where applicable
- **Relative imports within module** use `.js` extension: `from './types.js'`, `from './agent-runner.js'`
- **Cross-module imports** use `@/` alias: `from '@/errors/agent-error.js'`
- **ES module style** — `"type": "module"` in package.json; all imports must include `.js` extension

### Previous Story Intelligence (Story 2.3)

**Current state of `src/agents/index.ts`:** Contains only `export {}` — a placeholder. This story fills it.

**100 tests currently passing** (83 from Epic 1 + 17 from Epic 2 stories 2.2 and 2.3 pre-review + 4 added in code review) — verify no regressions.

**Established patterns to continue:**
- `node:` prefix for all Node.js built-in imports
- `async/await` for all async operations — no `.then()` chains
- Constructor-injected dependencies — no module-level singletons
- Co-located test files: `claude-agent-runner.test.ts` in `src/agents/`
- `moduleResolution: "bundler"` in tsconfig — relative imports within a module use `.js` extension
- Barrel re-export pattern: named exports with `.js` extension
- PascalCase class names, camelCase method names, no `I` prefix on interfaces
- Throw typed `AgentError` from the `errors` module when needed; `ClaudeAgentRunner` itself does NOT throw — it returns failure AgentResults

**Key pattern from Epic 2 code review:** The `withLock()` mutex pattern was added to `StateManager` for concurrent write safety. `ClaudeAgentRunner.run()` is a standalone async operation — no locking needed here (one story runs at a time in MVP).

### Anti-Patterns to Avoid

- **DO NOT** import Claude SDK anywhere except `claude-agent-runner.ts` — keep the SDK isolated
- **DO NOT** throw errors from `ClaudeAgentRunner.run()` — always return a failure `AgentResult` instead
- **DO NOT** use `options.tools` (the base set override) — use `options.allowedTools` (auto-approve list) to match the architecture's intent of granting specific tool permissions
- **DO NOT** set `options.continue` or `options.resume` — each agent run is a fresh session
- **DO NOT** import `ErrorCategory` from `@/errors/index.js` — import directly from `@/errors/agent-error.js` to be explicit
- **DO NOT** prefix the interface with `I`: use `AgentRunner`, not `IAgentRunner`
- **DO NOT** create `src/agents/runner.ts` — the file is `agent-runner.ts` per the architecture directory tree
- **DO NOT** use callbacks or `.catch()` — `async/await` + `try/catch` only
- **DO NOT** call `process.exit()` from within `ClaudeAgentRunner` — bubble up via AgentResult
- **DO NOT** hardcode model names — always use `config.model` passed in by caller

### References

- [Source: docs/planning-artifacts/architecture.md#Model-Provider-Abstraction] — `AgentRunner` interface with single `run()` method; `ClaudeAgentRunner` as MVP impl; orchestrator never imports SDK directly
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/agents/agent-runner.ts` (interface), `src/agents/claude-agent-runner.ts` (impl), `src/agents/types.ts` (AgentConfig, AgentResult)
- [Source: docs/planning-artifacts/architecture.md#Error-Handling-&-Logging] — Error categories: Transient = retry same tier, Capability = escalate, System = halt
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — kebab-case files, PascalCase types no prefix, async/await, function-param DI, `@/` path aliases, `.js` extensions
- [Source: docs/planning-artifacts/architecture.md#Architectural-Boundaries — Orchestrator-Agents-Boundary] — "Orchestrator calls `AgentRunner.run()` — never imports Claude SDK directly"
- [Source: docs/planning-artifacts/epics.md#Story-3.1] — Story requirements and all acceptance criteria
- [Source: node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts#query] — `query({ prompt, options })` returns `Query extends AsyncGenerator<SDKMessage>`; `Options.permissionMode`, `Options.allowedTools`, `Options.systemPrompt`, `Options.persistSession`, `Options.cwd`
- [Source: node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts#SDKResultSuccess] — `{ type: 'result', subtype: 'success', is_error: false, result: string, total_cost_usd: number, usage: NonNullableUsage, modelUsage: Record<string, ModelUsage> }`
- [Source: node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts#SDKResultError] — `{ type: 'result', subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd', errors: string[], total_cost_usd: number }`
- [Source: docs/implementation-artifacts/2-3-state-file-management-with-atomic-writes.md#Completion-Notes-List] — 100 tests currently passing; `node:` prefix convention; co-located tests; `.js` extension for relative imports

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Implemented `AgentConfig`, `AgentCostData`, and `AgentResult` discriminated union in `src/agents/types.ts`
- Implemented `AgentRunner` interface (single `run()` method) in `src/agents/agent-runner.ts`
- Implemented `ClaudeAgentRunner` class using `query()` async generator from `@anthropic-ai/claude-agent-sdk`
- Error mapping: thrown exceptions → `Transient`, `error_during_execution`/`error_max_turns` → `Capability`, all others → `System`
- `modelUsed` extracted from first key of `result.modelUsage`; falls back to `config.model` when empty
- All SDK imports isolated to `claude-agent-runner.ts` only
- 10 new tests added; all 110 tests pass (100 pre-existing + 10 new)
- Code review fixes: error_max_budget_usd now correctly maps to ErrorCategory.Capability per task 3.8; added test for this path; fixed makeGenerator type from any[] to typed union; combined duplicate imports in agent-runner.ts

### File List

- src/agents/types.ts (created)
- src/agents/agent-runner.ts (created)
- src/agents/claude-agent-runner.ts (created)
- src/agents/index.ts (modified)
- src/agents/agent-runner.test.ts (created)
- src/agents/claude-agent-runner.test.ts (created)

## Change Log

- 2026-03-05: Implemented AgentRunner interface, ClaudeAgentRunner class, types, barrel exports, and co-located tests (Story 3.1)
