import type { AppConfig } from './types.js'
import { ConfigError } from './config-loader.js'

export interface CliFlags {
  maxRetries?: number
  model?: string
  artifactsPath?: string
  workspacePath?: string
  claudeMdPath?: string
  projectRoot?: string
}

export function mergeCliFlags(config: AppConfig, flags: CliFlags): AppConfig {
  if (flags.maxRetries !== undefined) {
    if (!Number.isInteger(flags.maxRetries) || flags.maxRetries <= 0) {
      throw new ConfigError(
        `Invalid --max-retries: must be a positive integer (got: ${flags.maxRetries})`,
      )
    }
  }

  const result: AppConfig = {
    models: { ...config.models },
    retry: { ...config.retry },
    artifactsPath: config.artifactsPath,
    workspacePath: config.workspacePath,
    projectRoot: config.projectRoot,
    cost: { ...config.cost },
    ...(config.agents && { agents: config.agents }),
    ...(config.claudeMdPath && { claudeMdPath: config.claudeMdPath }),
  }

  if (flags.maxRetries !== undefined) {
    result.retry.maxAttempts = flags.maxRetries
  }
  if (flags.model !== undefined) {
    result.models.default = flags.model
  }
  if (flags.artifactsPath !== undefined) {
    result.artifactsPath = flags.artifactsPath
  }
  if (flags.workspacePath !== undefined) {
    result.workspacePath = flags.workspacePath
  }
  if (flags.projectRoot !== undefined) {
    result.projectRoot = flags.projectRoot
  }
  if (flags.claudeMdPath !== undefined) {
    result.claudeMdPath = flags.claudeMdPath
  }

  return result
}
