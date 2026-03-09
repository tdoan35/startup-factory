export type StoryStatus = 'pending' | 'in-progress' | 'completed' | 'failed'
export type EpicStatus = 'pending' | 'in-progress' | 'completed'
export type StoryPhase = 'pending' | 'storyCreation' | 'development' | 'codeReview' | 'qa' | 'completed' | 'failed'
export type RunStatus = 'running' | 'completed' | 'partial' | 'failed'

export interface ConfigSnapshot {
  defaultModel: string
  maxRetries: number
}

export interface RunMeta {
  status: RunStatus
  started: string
  config: ConfigSnapshot
  totalCost: number
}

export interface StoryState {
  status: StoryStatus
  phase: StoryPhase
  attempts: number
  cost: number
  escalationTier?: number
  failureNote?: string
  resumeFromPhase?: StoryPhase
}

export interface EpicState {
  status: EpicStatus
  stories: Record<string, StoryState>
}

export interface AppState {
  run: RunMeta
  epics: Record<string, EpicState>
}
