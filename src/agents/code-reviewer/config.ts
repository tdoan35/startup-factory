import { join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'
import { agentsDir } from '../resolve-prompt.js'

export const codeReviewerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
  maxRetries: 3,
  promptPath: join(agentsDir, 'code-reviewer', 'prompt.md'),
}
