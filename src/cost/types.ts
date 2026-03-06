export interface CostEntry {
  inputTokens: number
  outputTokens: number
  modelUsed: string
  totalCostUsd: number
}

export interface StoryCostSummary {
  storyKey: string
  entries: CostEntry[]
  totalCostUsd: number
}

export interface CostSummary {
  stories: StoryCostSummary[]
  totalCostUsd: number
}
