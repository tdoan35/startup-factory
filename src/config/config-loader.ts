import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import type { AppConfig } from './types.js'
import { DEFAULT_CONFIG, validateConfig } from './schema.js'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

async function loadConfigFile(configPath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(configPath, 'utf-8')
    return (parse(content) as Record<string, unknown>) ?? {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

function mergeWithDefaults(raw: Record<string, unknown>): AppConfig {
  const config: AppConfig = {
    models: {
      default: DEFAULT_CONFIG.models.default,
      escalation: [...DEFAULT_CONFIG.models.escalation],
    },
    retry: {
      maxAttempts: DEFAULT_CONFIG.retry.maxAttempts,
    },
    artifactsPath: DEFAULT_CONFIG.artifactsPath,
    workspacePath: DEFAULT_CONFIG.workspacePath,
    projectRoot: DEFAULT_CONFIG.projectRoot,
    cost: {
      tracking: DEFAULT_CONFIG.cost.tracking,
    },
  }

  if (raw.models && typeof raw.models === 'object' && !Array.isArray(raw.models)) {
    const m = raw.models as Record<string, unknown>
    if (typeof m.default === 'string' && m.default !== '') {
      config.models.default = m.default
    }
    if (Array.isArray(m.escalation)) {
      config.models.escalation = [...(m.escalation as string[])]
    }
  }

  if (raw.retry && typeof raw.retry === 'object' && !Array.isArray(raw.retry)) {
    const r = raw.retry as Record<string, unknown>
    if (typeof r.maxAttempts === 'number') {
      config.retry.maxAttempts = r.maxAttempts
    }
  }

  if (typeof raw.artifactsPath === 'string' && raw.artifactsPath !== '') {
    config.artifactsPath = raw.artifactsPath
  }

  if (typeof raw.workspacePath === 'string' && raw.workspacePath !== '') {
    config.workspacePath = raw.workspacePath
  }

  if (typeof raw.projectRoot === 'string' && raw.projectRoot !== '') {
    config.projectRoot = raw.projectRoot
  }

  if (raw.cost && typeof raw.cost === 'object' && !Array.isArray(raw.cost)) {
    const c = raw.cost as Record<string, unknown>
    if (typeof c.tracking === 'boolean') {
      config.cost.tracking = c.tracking
    }
  }

  if (raw.agents && typeof raw.agents === 'object' && !Array.isArray(raw.agents)) {
    config.agents = raw.agents as AppConfig['agents']
  }

  return config
}

export async function loadConfig(configPath?: string): Promise<AppConfig> {
  const path = configPath ?? 'startup-factory.yaml'
  const raw = await loadConfigFile(path)

  if (Object.keys(raw).length > 0) {
    const errors = validateConfig(raw)
    if (errors.length > 0) {
      throw new ConfigError(`Invalid config: ${errors.join(', ')}`)
    }
  }

  return mergeWithDefaults(raw)
}
