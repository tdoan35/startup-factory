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
  projectRoot: '/tmp/test-project',
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
    modelUsage: { 'claude-sonnet-4-6': { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, webSearchRequests: 0, costUSD: 0.042, contextWindow: 200000, maxOutputTokens: 8096 } },
    permission_denials: [],
    uuid: '00000000-0000-0000-0000-000000000001' as any,
    session_id: 'test-session-1',
    ...overrides,
  }
}

async function* makeGenerator(messages: (SDKResultSuccess | SDKResultError)[]) {
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
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      duration_ms: 1000,
      duration_api_ms: 900,
      num_turns: 1,
      stop_reason: null,
      total_cost_usd: 0.001,
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {},
      permission_denials: [],
      errors: ['Agent failed to complete task.'],
      uuid: '00000000-0000-0000-0000-000000000002' as any,
      session_id: 'test-session-2',
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
      type: 'result',
      subtype: 'error_max_turns',
      is_error: true,
      duration_ms: 1000,
      duration_api_ms: 900,
      num_turns: 100,
      stop_reason: 'max_turns',
      total_cost_usd: 0.5,
      usage: { input_tokens: 5000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {},
      permission_denials: [],
      errors: ['Max turns exceeded.'],
      uuid: '00000000-0000-0000-0000-000000000003' as any,
      session_id: 'test-session-3',
    }
    mockQuery.mockReturnValue(makeGenerator([errResult]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Capability)
    }
  })

  it('maps error_max_budget_usd to ErrorCategory.Capability', async () => {
    const errResult: SDKResultError = {
      type: 'result', subtype: 'error_max_budget_usd', is_error: true,
      duration_ms: 2000, duration_api_ms: 1800, num_turns: 5, stop_reason: null,
      total_cost_usd: 1.0, usage: { input_tokens: 10000, output_tokens: 5000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {}, permission_denials: [], errors: ['Budget limit exceeded.'],
      uuid: '00000000-0000-0000-0000-000000000004' as any, session_id: 'test-session-4',
    }
    mockQuery.mockReturnValue(makeGenerator([errResult]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Capability)
    }
  })

  it('maps thrown exception to ErrorCategory.Transient', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('ECONNREFUSED')
    })
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.Transient)
    }
  })

  it('returns System error when no result message received', async () => {
    mockQuery.mockReturnValue(makeGenerator([]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCategory).toBe(ErrorCategory.System)
      expect(result.output).toBe('No result message received from agent')
    }
  })

  it('falls back to config.model when modelUsage is empty', async () => {
    mockQuery.mockReturnValue(makeGenerator([mockSuccessResult({ modelUsage: {} })]) as any)
    const result = await runner.run(TEST_CONFIG)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cost.modelUsed).toBe('claude-sonnet-4-6')
    }
  })
})
