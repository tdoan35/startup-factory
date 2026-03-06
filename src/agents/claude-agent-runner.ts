import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultMessage, SDKResultError } from '@anthropic-ai/claude-agent-sdk'
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

      const errorSubtype = (resultMessage as SDKResultError).subtype
      const errorCategory =
        errorSubtype === 'error_during_execution' || errorSubtype === 'error_max_turns' || errorSubtype === 'error_max_budget_usd'
          ? ErrorCategory.Capability
          : ErrorCategory.System
      const errorOutput = (resultMessage as SDKResultError).errors?.join('\n') ?? 'Agent run failed'
      return { success: false, output: errorOutput, cost, errorCategory }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, output: message, cost: zeroCost, errorCategory: ErrorCategory.Transient }
    }
  }
}
