import type { AppConfig } from './types.js'

export const DEFAULT_CONFIG: AppConfig = {
  models: {
    default: 'claude-sonnet-4-6',
    escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'],
  },
  retry: {
    maxAttempts: 3,
  },
  artifactsPath: './planning-artifacts',
  workspacePath: '.startup-factory',
  projectRoot: '.',
  cost: {
    tracking: true,
  },
}

export function validateConfig(raw: Record<string, unknown>): string[] {
  const errors: string[] = []

  const knownKeys = new Set(['models', 'retry', 'artifactsPath', 'workspacePath', 'projectRoot', 'cost', 'claudeMdPath', 'agents'])
  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) {
      errors.push(`Unknown config key: "${key}"`)
    }
  }

  const models = raw.models
  if (models !== undefined) {
    if (typeof models !== 'object' || models === null || Array.isArray(models)) {
      errors.push('models must be an object')
    } else {
      const m = models as Record<string, unknown>
      if (m.default !== undefined && (typeof m.default !== 'string' || m.default === '')) {
        errors.push(`models.default must be a non-empty string (got: ${JSON.stringify(m.default)})`)
      }
      if (m.escalation !== undefined) {
        if (
          !Array.isArray(m.escalation) ||
          !m.escalation.every((s: unknown) => typeof s === 'string' && s !== '')
        ) {
          errors.push('models.escalation must be an array of non-empty strings')
        }
      }
    }
  }

  const retry = raw.retry
  if (retry !== undefined) {
    if (typeof retry !== 'object' || retry === null || Array.isArray(retry)) {
      errors.push('retry must be an object')
    } else {
      const r = retry as Record<string, unknown>
      if (
        r.maxAttempts !== undefined &&
        (!Number.isInteger(r.maxAttempts) || (r.maxAttempts as number) <= 0)
      ) {
        errors.push(`retry.maxAttempts must be a positive integer (got: ${r.maxAttempts})`)
      }
    }
  }

  if (
    raw.artifactsPath !== undefined &&
    (typeof raw.artifactsPath !== 'string' || raw.artifactsPath === '')
  ) {
    errors.push(`artifactsPath must be a non-empty string (got: ${JSON.stringify(raw.artifactsPath)})`)
  }

  if (
    raw.workspacePath !== undefined &&
    (typeof raw.workspacePath !== 'string' || raw.workspacePath === '')
  ) {
    errors.push(`workspacePath must be a non-empty string (got: ${JSON.stringify(raw.workspacePath)})`)
  }

  if (
    raw.projectRoot !== undefined &&
    (typeof raw.projectRoot !== 'string' || raw.projectRoot === '')
  ) {
    errors.push(`projectRoot must be a non-empty string (got: ${JSON.stringify(raw.projectRoot)})`)
  }

  if (
    raw.claudeMdPath !== undefined &&
    (typeof raw.claudeMdPath !== 'string' || raw.claudeMdPath === '')
  ) {
    errors.push(`claudeMdPath must be a non-empty string (got: ${JSON.stringify(raw.claudeMdPath)})`)
  }

  const cost = raw.cost
  if (cost !== undefined) {
    if (typeof cost !== 'object' || cost === null || Array.isArray(cost)) {
      errors.push('cost must be an object')
    } else {
      const c = cost as Record<string, unknown>
      if (c.tracking !== undefined && typeof c.tracking !== 'boolean') {
        errors.push(`cost.tracking must be a boolean (got: ${JSON.stringify(c.tracking)})`)
      }
    }
  }

  const agents = raw.agents
  if (agents !== undefined) {
    if (typeof agents !== 'object' || agents === null || Array.isArray(agents)) {
      errors.push('agents must be an object')
    } else {
      const validPhases = new Set(['storyCreation', 'development', 'codeReview', 'qa'])
      const a = agents as Record<string, unknown>
      for (const key of Object.keys(a)) {
        if (!validPhases.has(key)) {
          errors.push(`agents: unknown phase "${key}" (valid: storyCreation, development, codeReview, qa)`)
          continue
        }
        const phaseConfig = a[key]
        if (typeof phaseConfig !== 'object' || phaseConfig === null || Array.isArray(phaseConfig)) {
          errors.push(`agents.${key} must be an object`)
          continue
        }
        const pc = phaseConfig as Record<string, unknown>
        if (pc.env !== undefined) {
          if (typeof pc.env !== 'object' || pc.env === null || Array.isArray(pc.env)) {
            errors.push(`agents.${key}.env must be an object`)
          } else {
            for (const [envKey, envVal] of Object.entries(pc.env as Record<string, unknown>)) {
              if (typeof envVal !== 'string') {
                errors.push(`agents.${key}.env.${envKey} must be a string (got: ${JSON.stringify(envVal)})`)
              }
            }
          }
        }
      }
    }
  }

  return errors
}
