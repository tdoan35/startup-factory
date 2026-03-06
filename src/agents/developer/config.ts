import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const developerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
