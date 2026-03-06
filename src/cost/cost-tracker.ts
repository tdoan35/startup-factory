import type { StateManager } from '@/workspace/state-manager.js'
import type { CostEntry, CostSummary, StoryCostSummary } from './types.js'

export class CostTracker {
  private readonly entries = new Map<string, CostEntry[]>()

  record(storyKey: string, cost: CostEntry): void {
    const list = this.entries.get(storyKey) ?? []
    list.push({ ...cost })
    this.entries.set(storyKey, list)
  }

  getStoryCost(storyKey: string): number {
    const list = this.entries.get(storyKey) ?? []
    return list.reduce((sum, e) => sum + e.totalCostUsd, 0)
  }

  getTotalCost(): number {
    let total = 0
    for (const storyKey of this.entries.keys()) {
      total += this.getStoryCost(storyKey)
    }
    return total
  }

  getSummary(): CostSummary {
    const stories: StoryCostSummary[] = []
    for (const [storyKey, list] of this.entries.entries()) {
      const totalCostUsd = list.reduce((sum, e) => sum + e.totalCostUsd, 0)
      stories.push({ storyKey, entries: [...list], totalCostUsd })
    }
    const totalCostUsd = stories.reduce((sum, s) => sum + s.totalCostUsd, 0)
    return { stories, totalCostUsd }
  }

  async updateRunCostInState(stateManager: StateManager): Promise<void> {
    await stateManager.updateRun({ totalCost: this.getTotalCost() })
  }
}
