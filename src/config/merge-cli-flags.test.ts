import { describe, it, expect } from 'vitest'
import { mergeCliFlags } from './merge-cli-flags.js'
import { ConfigError } from './config-loader.js'
import { DEFAULT_CONFIG } from './schema.js'
import type { AppConfig } from './types.js'

const baseConfig: AppConfig = {
  models: {
    default: 'claude-sonnet-4-6',
    escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'],
  },
  retry: { maxAttempts: 3 },
  artifactsPath: './planning-artifacts',
  workspacePath: '.startup-factory',
  cost: { tracking: true },
}

describe('mergeCliFlags', () => {
  it('returns config unchanged when no flags are provided', () => {
    const result = mergeCliFlags(baseConfig, {})
    expect(result).toEqual(baseConfig)
  })

  it('overrides retry.maxAttempts with maxRetries flag', () => {
    const result = mergeCliFlags(baseConfig, { maxRetries: 5 })
    expect(result.retry.maxAttempts).toBe(5)
  })

  it('overrides models.default with model flag', () => {
    const result = mergeCliFlags(baseConfig, { model: 'claude-opus-4-6' })
    expect(result.models.default).toBe('claude-opus-4-6')
  })

  it('overrides artifactsPath with artifactsPath flag', () => {
    const result = mergeCliFlags(baseConfig, { artifactsPath: './custom-artifacts' })
    expect(result.artifactsPath).toBe('./custom-artifacts')
  })

  it('overrides workspacePath with workspacePath flag', () => {
    const result = mergeCliFlags(baseConfig, { workspacePath: '.custom-workspace' })
    expect(result.workspacePath).toBe('.custom-workspace')
  })

  it('applies multiple flags simultaneously', () => {
    const result = mergeCliFlags(baseConfig, {
      maxRetries: 10,
      model: 'claude-opus-4-6',
      artifactsPath: './my-artifacts',
      workspacePath: '.my-workspace',
    })
    expect(result.retry.maxAttempts).toBe(10)
    expect(result.models.default).toBe('claude-opus-4-6')
    expect(result.artifactsPath).toBe('./my-artifacts')
    expect(result.workspacePath).toBe('.my-workspace')
  })

  it('does NOT override values when flags are undefined', () => {
    const result = mergeCliFlags(baseConfig, {
      maxRetries: undefined,
      model: undefined,
      artifactsPath: undefined,
      workspacePath: undefined,
    })
    expect(result.retry.maxAttempts).toBe(baseConfig.retry.maxAttempts)
    expect(result.models.default).toBe(baseConfig.models.default)
    expect(result.artifactsPath).toBe(baseConfig.artifactsPath)
    expect(result.workspacePath).toBe(baseConfig.workspacePath)
  })

  it('does not mutate the original config', () => {
    const original = structuredClone(baseConfig)
    mergeCliFlags(baseConfig, { maxRetries: 99, model: 'claude-opus-4-6' })
    expect(baseConfig).toEqual(original)
  })

  it('preserves unaffected fields (cost, escalation)', () => {
    const result = mergeCliFlags(baseConfig, { maxRetries: 5 })
    expect(result.cost).toEqual(baseConfig.cost)
    expect(result.models.escalation).toEqual(baseConfig.models.escalation)
  })

  it('CLI flag takes precedence over config file value (DEFAULT_CONFIG scenario)', () => {
    // Simulate: config file has maxAttempts=3 (defaults), CLI overrides to 7
    const result = mergeCliFlags(DEFAULT_CONFIG, { maxRetries: 7 })
    expect(result.retry.maxAttempts).toBe(7)
    // Other values remain as defaults
    expect(result.models.default).toBe(DEFAULT_CONFIG.models.default)
  })

  it('throws ConfigError for negative maxRetries', () => {
    expect(() => mergeCliFlags(baseConfig, { maxRetries: -1 })).toThrow(ConfigError)
    expect(() => mergeCliFlags(baseConfig, { maxRetries: -1 })).toThrow('Invalid --max-retries')
  })

  it('throws ConfigError for zero maxRetries', () => {
    expect(() => mergeCliFlags(baseConfig, { maxRetries: 0 })).toThrow(ConfigError)
  })

  it('throws ConfigError for NaN maxRetries (e.g. from invalid --max-retries foo)', () => {
    expect(() => mergeCliFlags(baseConfig, { maxRetries: NaN })).toThrow(ConfigError)
    expect(() => mergeCliFlags(baseConfig, { maxRetries: NaN })).toThrow('Invalid --max-retries')
  })

  it('throws ConfigError for non-integer maxRetries', () => {
    expect(() => mergeCliFlags(baseConfig, { maxRetries: 1.5 })).toThrow(ConfigError)
  })
})
