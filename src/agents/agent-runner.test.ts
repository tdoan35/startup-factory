import { describe, it, expect } from 'vitest'
import type { AgentRunner } from './agent-runner.js'
import type { AgentConfig, AgentResult } from './types.js'

class MockRunner implements AgentRunner {
  async run(_config: AgentConfig): Promise<AgentResult> {
    return {
      success: true,
      output: 'done',
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-sonnet-4-6' },
    }
  }
}

describe('AgentRunner interface', () => {
  it('can be implemented by a mock class', async () => {
    const runner: AgentRunner = new MockRunner()
    const config: AgentConfig = {
      model: 'claude-sonnet-4-6',
      systemPrompt: 'Test system prompt',
      allowedTools: ['Read'],
      workspacePath: '/tmp/test',
      prompt: 'Do something',
    }
    const result = await runner.run(config)
    expect(result.success).toBe(true)
  })

  it('returns AgentResult with cost data', async () => {
    const runner: AgentRunner = new MockRunner()
    const config: AgentConfig = {
      model: 'claude-sonnet-4-6',
      systemPrompt: 'Test',
      allowedTools: [],
      workspacePath: '/tmp/test',
      prompt: 'Test prompt',
    }
    const result = await runner.run(config)
    expect(result).toHaveProperty('cost')
    expect(result.cost).toHaveProperty('inputTokens')
    expect(result.cost).toHaveProperty('outputTokens')
    expect(result.cost).toHaveProperty('totalCostUsd')
    expect(result.cost).toHaveProperty('modelUsed')
  })
})
