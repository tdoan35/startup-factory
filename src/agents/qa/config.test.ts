import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { qaConfig } from './config.js'

describe('qaConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(qaConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Bash, Write in allowedTools', () => {
    expect(qaConfig.allowedTools).toContain('Read')
    expect(qaConfig.allowedTools).toContain('Glob')
    expect(qaConfig.allowedTools).toContain('Grep')
    expect(qaConfig.allowedTools).toContain('Bash')
    expect(qaConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Edit in allowedTools (qa-report.md is always a new file)', () => {
    expect(qaConfig.allowedTools).not.toContain('Edit')
  })

  it('has exactly 5 allowed tools', () => {
    expect(qaConfig.allowedTools).toHaveLength(5)
  })

  it('has maxRetries of 3', () => {
    expect(qaConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(qaConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(qaConfig.promptPath)).toBe(true)
  })
})
