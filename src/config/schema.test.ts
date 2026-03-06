import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, validateConfig } from './schema.js'

describe('DEFAULT_CONFIG', () => {
  it('has the expected default values', () => {
    expect(DEFAULT_CONFIG.models.default).toBe('claude-sonnet-4-6')
    expect(DEFAULT_CONFIG.models.escalation).toEqual(['claude-sonnet-4-6', 'claude-opus-4-6'])
    expect(DEFAULT_CONFIG.retry.maxAttempts).toBe(3)
    expect(DEFAULT_CONFIG.artifactsPath).toBe('./planning-artifacts')
    expect(DEFAULT_CONFIG.workspacePath).toBe('.startup-factory')
    expect(DEFAULT_CONFIG.cost.tracking).toBe(true)
  })
})

describe('validateConfig', () => {
  it('returns no errors for a valid full config', () => {
    const errors = validateConfig({
      models: { default: 'claude-opus-4-6', escalation: ['claude-opus-4-6'] },
      retry: { maxAttempts: 5 },
      artifactsPath: './artifacts',
      workspacePath: '.workspace',
      cost: { tracking: false },
    })
    expect(errors).toEqual([])
  })

  it('returns no errors for an empty config (all defaults)', () => {
    expect(validateConfig({})).toEqual([])
  })

  it('returns error for unknown top-level key', () => {
    const errors = validateConfig({ unknownKey: 'value' })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Unknown config key')
    expect(errors[0]).toContain('unknownKey')
  })

  it('returns error for non-positive retry.maxAttempts', () => {
    const errors = validateConfig({ retry: { maxAttempts: -1 } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('retry.maxAttempts')
    expect(errors[0]).toContain('-1')
  })

  it('returns error for zero retry.maxAttempts', () => {
    const errors = validateConfig({ retry: { maxAttempts: 0 } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('retry.maxAttempts')
  })

  it('returns error for non-integer retry.maxAttempts', () => {
    const errors = validateConfig({ retry: { maxAttempts: 1.5 } })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('retry.maxAttempts')
  })

  it('returns error for empty models.default', () => {
    const errors = validateConfig({ models: { default: '' } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('models.default')
  })

  it('returns error for models.default that is not a string', () => {
    const errors = validateConfig({ models: { default: 42 } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('models.default')
  })

  it('returns error for models.escalation with non-string items', () => {
    const errors = validateConfig({ models: { escalation: [42, 'valid'] } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('models.escalation')
  })

  it('returns error for models.escalation with empty string items', () => {
    const errors = validateConfig({ models: { escalation: [''] } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('models.escalation')
  })

  it('returns error for empty artifactsPath', () => {
    const errors = validateConfig({ artifactsPath: '' })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('artifactsPath')
  })

  it('returns error for empty workspacePath', () => {
    const errors = validateConfig({ workspacePath: '' })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('workspacePath')
  })

  it('returns error for non-boolean cost.tracking', () => {
    const errors = validateConfig({ cost: { tracking: 'yes' } })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('cost.tracking')
  })

  it('returns all errors at once for multiple invalid fields', () => {
    const errors = validateConfig({
      retry: { maxAttempts: -1 },
      models: { default: '' },
      cost: { tracking: 'yes' },
    })
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})
