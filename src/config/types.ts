export interface ModelsConfig {
  default: string
  escalation: string[]
}

export interface RetryConfig {
  maxAttempts: number
}

export interface CostConfig {
  tracking: boolean
}

export interface AppConfig {
  models: ModelsConfig
  retry: RetryConfig
  artifactsPath: string
  workspacePath: string
  projectRoot: string
  cost: CostConfig
  claudeMdPath?: string
}
