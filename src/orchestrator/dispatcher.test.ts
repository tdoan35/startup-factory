import { vi, describe, it, expect, beforeEach } from 'vitest'
import { runDispatcher } from './dispatcher.js'

const { mockRunStoryPipeline } = vi.hoisted(() => ({
  mockRunStoryPipeline: vi.fn(),
}))
vi.mock('./pipeline.js', () => ({ runStoryPipeline: mockRunStoryPipeline }))

const makeStory = (epicKey: string, storyKey: string) => ({
  epicKey,
  storyKey,
  status: 'pending' as const,
  phase: 'pending' as const,
  attempts: 0,
  cost: 0,
})

describe('runDispatcher', () => {
  const mockStateManager = { getStoriesByStatus: vi.fn(), updateRun: vi.fn().mockResolvedValue(undefined) }
  const mockRunner = { run: vi.fn() }
  const mockLog = vi.fn()
  const mockLogError = vi.fn()

  const baseOpts = {
    runner: mockRunner as never,
    stateManager: mockStateManager as never,
    workspacePath: '/workspace',
    appConfig: {
      models: { default: 'claude-haiku-4-5-20251001', escalation: [] },
      retry: { maxAttempts: 3 },
      artifactsPath: '/artifacts',
      workspacePath: '/workspace',
      cost: { tracking: false },
    } as never,
    log: mockLog,
    logError: mockLogError,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { completedCount: 0, failedCount: 0 } when no pending stories', async () => {
    mockStateManager.getStoriesByStatus.mockResolvedValue([])
    const result = await runDispatcher(baseOpts)
    expect(result).toEqual({ completedCount: 0, failedCount: 0 })
    expect(mockRunStoryPipeline).not.toHaveBeenCalled()
  })

  it('returns { completedCount: 1, failedCount: 0 } when 1 story completes', async () => {
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce([makeStory('epic-1', '1-1')])
      .mockResolvedValueOnce([])
    mockRunStoryPipeline.mockResolvedValue('completed')
    const result = await runDispatcher(baseOpts)
    expect(result).toEqual({ completedCount: 1, failedCount: 0 })
    expect(mockLog).toHaveBeenCalledWith('Starting story epic-1/1-1')
  })

  it('returns { completedCount: 0, failedCount: 1 } when 1 story fails', async () => {
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce([makeStory('epic-1', '1-1')])
      .mockResolvedValueOnce([])
    mockRunStoryPipeline.mockResolvedValue('failed')
    const result = await runDispatcher(baseOpts)
    expect(result).toEqual({ completedCount: 0, failedCount: 1 })
  })

  it('returns { completedCount: 2, failedCount: 1 } for 3 stories (2 complete, 1 fail)', async () => {
    const stories = [
      makeStory('epic-1', '1-1'),
      makeStory('epic-1', '1-2'),
      makeStory('epic-1', '1-3'),
    ]
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce(stories.slice(0))
      .mockResolvedValueOnce(stories.slice(1))
      .mockResolvedValueOnce(stories.slice(2))
      .mockResolvedValueOnce([])
    mockRunStoryPipeline
      .mockResolvedValueOnce('completed')
      .mockResolvedValueOnce('completed')
      .mockResolvedValueOnce('failed')
    const result = await runDispatcher(baseOpts)
    expect(result).toEqual({ completedCount: 2, failedCount: 1 })
  })

  it('calls pipeline with correct epicKey and storyKey from getStoriesByStatus', async () => {
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce([makeStory('epic-2', '2-3')])
      .mockResolvedValueOnce([])
    mockRunStoryPipeline.mockResolvedValue('completed')
    await runDispatcher(baseOpts)
    expect(mockRunStoryPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ epicKey: 'epic-2', storyKey: '2-3' })
    )
  })

  it('continues to next pending story after a failed story (non-blocking)', async () => {
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce([makeStory('epic-1', '1-1'), makeStory('epic-1', '1-2')])
      .mockResolvedValueOnce([makeStory('epic-1', '1-2')])
      .mockResolvedValueOnce([])
    mockRunStoryPipeline
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('completed')
    const result = await runDispatcher(baseOpts)
    expect(result).toEqual({ completedCount: 1, failedCount: 1 })
    expect(mockRunStoryPipeline).toHaveBeenCalledTimes(2)
  })

  it('calls stateManager.updateRun with totalCost after all stories finish', async () => {
    mockStateManager.getStoriesByStatus
      .mockResolvedValueOnce([makeStory('epic-1', '1-1')])
      .mockResolvedValueOnce([])
    mockRunStoryPipeline.mockResolvedValue('completed')
    await runDispatcher(baseOpts)
    expect(mockStateManager.updateRun).toHaveBeenCalledOnce()
    expect(mockStateManager.updateRun).toHaveBeenCalledWith({ totalCost: 0 })
  })

  it('calls stateManager.updateRun even when no stories are pending', async () => {
    mockStateManager.getStoriesByStatus.mockResolvedValue([])
    await runDispatcher(baseOpts)
    expect(mockStateManager.updateRun).toHaveBeenCalledOnce()
    expect(mockStateManager.updateRun).toHaveBeenCalledWith({ totalCost: 0 })
  })

  it('logs and rethrows when runStoryPipeline throws a system error', async () => {
    mockStateManager.getStoriesByStatus.mockResolvedValueOnce([makeStory('epic-1', '1-1')])
    const systemError = new Error('File system failure')
    mockRunStoryPipeline.mockRejectedValue(systemError)

    await expect(runDispatcher(baseOpts)).rejects.toThrow('File system failure')
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('System error for story epic-1/1-1'),
    )
  })
})
