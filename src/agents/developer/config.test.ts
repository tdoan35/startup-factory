import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { developerConfig } from './config.js'

describe('developerConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(developerConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes all 6 tools in allowedTools', () => {
    const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    for (const tool of tools) {
      expect(developerConfig.allowedTools).toContain(tool)
    }
  })

  it('has exactly 6 allowed tools', () => {
    expect(developerConfig.allowedTools).toHaveLength(6)
  })

  it('has maxRetries of 3', () => {
    expect(developerConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(developerConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(developerConfig.promptPath)).toBe(true)
  })
})
