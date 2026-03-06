import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { storyCreatorConfig } from './config.js'

describe('storyCreatorConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(storyCreatorConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Write in allowedTools', () => {
    expect(storyCreatorConfig.allowedTools).toContain('Read')
    expect(storyCreatorConfig.allowedTools).toContain('Glob')
    expect(storyCreatorConfig.allowedTools).toContain('Grep')
    expect(storyCreatorConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Bash in allowedTools (read-only + write spec only)', () => {
    expect(storyCreatorConfig.allowedTools).not.toContain('Bash')
  })

  it('does NOT include Edit in allowedTools (spec is always a new file)', () => {
    expect(storyCreatorConfig.allowedTools).not.toContain('Edit')
  })

  it('has maxRetries of 3', () => {
    expect(storyCreatorConfig.maxRetries).toBe(3)
  })

  it('has exactly 4 allowed tools', () => {
    expect(storyCreatorConfig.allowedTools).toHaveLength(4)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(storyCreatorConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(storyCreatorConfig.promptPath)).toBe(true)
  })
})
