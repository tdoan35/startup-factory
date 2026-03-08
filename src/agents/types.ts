import type { ErrorCategory } from '@/errors/agent-error.js'

export interface AgentConfig {
  model: string
  systemPrompt: string
  allowedTools: string[]
  workspacePath: string
  projectRoot: string
  prompt: string
  log?: (msg: string) => void
}

export interface AgentCostData {
  inputTokens: number
  outputTokens: number
  totalCostUsd: number
  modelUsed: string
}

export type AgentResult =
  | { success: true; output: string; cost: AgentCostData }
  | { success: false; output: string; cost: AgentCostData; errorCategory: ErrorCategory }

export interface AgentRoleConfig {
  model: string
  allowedTools: string[]
  maxRetries: number
  promptPath: string
}
