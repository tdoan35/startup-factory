import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { codeReviewerConfig } from './config.js'

describe('codeReviewerConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(codeReviewerConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Write in allowedTools', () => {
    expect(codeReviewerConfig.allowedTools).toContain('Read')
    expect(codeReviewerConfig.allowedTools).toContain('Glob')
    expect(codeReviewerConfig.allowedTools).toContain('Grep')
    expect(codeReviewerConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Bash in allowedTools (review reads and writes only)', () => {
    expect(codeReviewerConfig.allowedTools).not.toContain('Bash')
  })

  it('does NOT include Edit in allowedTools (review.md is always a new file)', () => {
    expect(codeReviewerConfig.allowedTools).not.toContain('Edit')
  })

  it('has exactly 4 allowed tools', () => {
    expect(codeReviewerConfig.allowedTools).toHaveLength(4)
  })

  it('has maxRetries of 3', () => {
    expect(codeReviewerConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(codeReviewerConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(codeReviewerConfig.promptPath)).toBe(true)
  })
})
