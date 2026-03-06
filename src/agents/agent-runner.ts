import type { AgentConfig, AgentResult } from './types.js'

export interface AgentRunner {
  run(config: AgentConfig): Promise<AgentResult>
}
