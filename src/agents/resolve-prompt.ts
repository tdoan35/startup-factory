import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// This file lives at src/agents/resolve-prompt.ts.
// In dev (tsx): import.meta.url resolves to this file → dirname = src/agents/
// In bundle (tsup): import.meta.url resolves to dist/index.js → dirname = dist/
//   Prompt files are copied to dist/agents/*/prompt.md by tsup onSuccess.
//   We detect the bundle case and append 'agents/' to reach them.
const thisDir = dirname(fileURLToPath(import.meta.url))
const isBundled = !thisDir.endsWith('agents')

export const agentsDir = isBundled ? join(thisDir, 'agents') : thisDir
