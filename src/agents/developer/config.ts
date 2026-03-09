import { join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'
import { agentsDir } from '../resolve-prompt.js'

export const developerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  maxRetries: 3,
  promptPath: join(agentsDir, 'developer', 'prompt.md'),
}
