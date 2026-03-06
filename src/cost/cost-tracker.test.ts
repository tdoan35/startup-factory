import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CostTracker } from './cost-tracker.js'
import type { StateManager } from '@/workspace/state-manager.js'

const makeMockStateManager = () =>
  ({
    updateRun: vi.fn().mockResolvedValue(undefined),
  }) as unknown as StateManager

describe('CostTracker', () => {
  let tracker: CostTracker

  beforeEach(() => {
    tracker = new CostTracker()
  })

  describe('record()', () => {
    it('stores entries per story key', () => {
      tracker.record('story-1', { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.01 })
      tracker.record('story-1', { inputTokens: 200, outputTokens: 100, modelUsed: 'claude-3', totalCostUsd: 0.02 })
      tracker.record('story-2', { inputTokens: 300, outputTokens: 150, modelUsed: 'claude-3', totalCostUsd: 0.03 })

      expect(tracker.getStoryCost('story-1')).toBeCloseTo(0.03)
      expect(tracker.getStoryCost('story-2')).toBeCloseTo(0.03)
    })

    it('stores a copy of the entry (not reference)', () => {
      const entry = { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.01 }
      tracker.record('story-1', entry)
      entry.totalCostUsd = 999
      expect(tracker.getStoryCost('story-1')).toBeCloseTo(0.01)
    })
  })

  describe('getStoryCost()', () => {
    it('sums correctly for multi-run story', () => {
      tracker.record('story-1', { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.05 })
      tracker.record('story-1', { inputTokens: 200, outputTokens: 100, modelUsed: 'claude-3', totalCostUsd: 0.10 })
      tracker.record('story-1', { inputTokens: 300, outputTokens: 150, modelUsed: 'claude-3', totalCostUsd: 0.15 })

      expect(tracker.getStoryCost('story-1')).toBeCloseTo(0.30)
    })

    it('returns 0 for unknown story key', () => {
      expect(tracker.getStoryCost('no-such-story')).toBe(0)
    })
  })

  describe('getTotalCost()', () => {
    it('sums across all stories', () => {
      tracker.record('story-1', { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.10 })
      tracker.record('story-2', { inputTokens: 200, outputTokens: 100, modelUsed: 'claude-3', totalCostUsd: 0.20 })
      tracker.record('story-3', { inputTokens: 300, outputTokens: 150, modelUsed: 'claude-3', totalCostUsd: 0.30 })

      expect(tracker.getTotalCost()).toBeCloseTo(0.60)
    })

    it('returns 0 when no entries recorded', () => {
      expect(tracker.getTotalCost()).toBe(0)
    })
  })

  describe('getSummary()', () => {
    it('returns correct CostSummary shape', () => {
      tracker.record('story-1', { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.10 })
      tracker.record('story-1', { inputTokens: 200, outputTokens: 100, modelUsed: 'claude-3', totalCostUsd: 0.20 })
      tracker.record('story-2', { inputTokens: 300, outputTokens: 150, modelUsed: 'claude-opus', totalCostUsd: 0.50 })

      const summary = tracker.getSummary()

      expect(summary.totalCostUsd).toBeCloseTo(0.80)
      expect(summary.stories).toHaveLength(2)

      const story1 = summary.stories.find(s => s.storyKey === 'story-1')!
      expect(story1.entries).toHaveLength(2)
      expect(story1.totalCostUsd).toBeCloseTo(0.30)

      const story2 = summary.stories.find(s => s.storyKey === 'story-2')!
      expect(story2.entries).toHaveLength(1)
      expect(story2.totalCostUsd).toBeCloseTo(0.50)
    })

    it('returns empty summary when no entries', () => {
      const summary = tracker.getSummary()
      expect(summary.stories).toHaveLength(0)
      expect(summary.totalCostUsd).toBe(0)
    })
  })

  describe('updateRunCostInState()', () => {
    it('calls stateManager.updateRun with correct totalCost', async () => {
      const mock = makeMockStateManager()
      tracker.record('story-a', { inputTokens: 100, outputTokens: 50, modelUsed: 'claude-3', totalCostUsd: 0.10 })
      tracker.record('story-b', { inputTokens: 200, outputTokens: 100, modelUsed: 'claude-3', totalCostUsd: 0.20 })

      await tracker.updateRunCostInState(mock)

      expect(mock.updateRun).toHaveBeenCalledOnce()
      expect(mock.updateRun).toHaveBeenCalledWith({ totalCost: expect.closeTo(0.30, 10) })
    })

    it('calls stateManager.updateRun with 0 when no entries', async () => {
      const mock = makeMockStateManager()
      await tracker.updateRunCostInState(mock)
      expect(mock.updateRun).toHaveBeenCalledWith({ totalCost: 0 })
    })
  })
})
