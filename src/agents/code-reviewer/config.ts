import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const codeReviewerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
