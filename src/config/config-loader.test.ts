import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig, ConfigError } from './config-loader.js'
import { DEFAULT_CONFIG } from './schema.js'

describe('loadConfig', () => {
  const tmpDir = join(import.meta.dirname, '__tmp__')

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns defaults when no config file exists', async () => {
    const config = await loadConfig(join(tmpDir, 'nonexistent.yaml'))
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('parses all config fields from a valid YAML file', async () => {
    const yamlContent = `
models:
  default: claude-opus-4-6
  escalation:
    - claude-opus-4-6
retry:
  maxAttempts: 5
artifactsPath: ./my-artifacts
workspacePath: .my-workspace
cost:
  tracking: false
`
    const configPath = join(tmpDir, 'startup-factory.yaml')
    await writeFile(configPath, yamlContent, 'utf-8')

    const config = await loadConfig(configPath)

    expect(config.models.default).toBe('claude-opus-4-6')
    expect(config.models.escalation).toEqual(['claude-opus-4-6'])
    expect(config.retry.maxAttempts).toBe(5)
    expect(config.artifactsPath).toBe('./my-artifacts')
    expect(config.workspacePath).toBe('.my-workspace')
    expect(config.cost.tracking).toBe(false)
  })

  it('merges file config over defaults — missing file fields fall back to defaults', async () => {
    const yamlContent = `
retry:
  maxAttempts: 10
`
    const configPath = join(tmpDir, 'startup-factory.yaml')
    await writeFile(configPath, yamlContent, 'utf-8')

    const config = await loadConfig(configPath)

    expect(config.retry.maxAttempts).toBe(10)
    expect(config.models.default).toBe(DEFAULT_CONFIG.models.default)
    expect(config.artifactsPath).toBe(DEFAULT_CONFIG.artifactsPath)
    expect(config.cost.tracking).toBe(DEFAULT_CONFIG.cost.tracking)
  })

  it('uses default config path when no path provided and file is absent', async () => {
    const originalCwd = process.cwd()
    try {
      // chdir to tmpDir (no startup-factory.yaml there) to guarantee a controlled environment
      process.chdir(tmpDir)
      const config = await loadConfig()
      expect(config).toEqual(DEFAULT_CONFIG)
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('throws ConfigError with clear message for invalid fields', async () => {
    const yamlContent = `
retry:
  maxAttempts: -5
models:
  default: ''
`
    const configPath = join(tmpDir, 'startup-factory.yaml')
    await writeFile(configPath, yamlContent, 'utf-8')

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigError)
    await expect(loadConfig(configPath)).rejects.toThrow('Invalid config:')
  })

  it('throws ConfigError that identifies all invalid fields', async () => {
    const yamlContent = `
retry:
  maxAttempts: -1
cost:
  tracking: maybe
`
    const configPath = join(tmpDir, 'startup-factory.yaml')
    await writeFile(configPath, yamlContent, 'utf-8')

    let error: unknown
    try {
      await loadConfig(configPath)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ConfigError)
    const msg = (error as ConfigError).message
    expect(msg).toContain('retry.maxAttempts')
    expect(msg).toContain('cost.tracking')
  })

  it('throws ConfigError for unknown top-level fields', async () => {
    const yamlContent = `
typo_field: value
`
    const configPath = join(tmpDir, 'startup-factory.yaml')
    await writeFile(configPath, yamlContent, 'utf-8')

    await expect(loadConfig(configPath)).rejects.toThrow(ConfigError)
    await expect(loadConfig(configPath)).rejects.toThrow('typo_field')
  })

  it('ConfigError has name "ConfigError"', async () => {
    const err = new ConfigError('test')
    expect(err.name).toBe('ConfigError')
    expect(err).toBeInstanceOf(Error)
  })
})
