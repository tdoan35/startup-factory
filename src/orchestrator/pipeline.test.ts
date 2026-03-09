import { vi, describe, it, expect, beforeEach } from 'vitest'
import { runStoryPipeline } from './pipeline.js'
import { ErrorCategory } from '@/errors/agent-error.js'

const { mockReadFile, mockMkdir } = vi.hoisted(() => ({ mockReadFile: vi.fn(), mockMkdir: vi.fn().mockResolvedValue(undefined) }))
vi.mock('node:fs/promises', () => ({ readFile: mockReadFile, mkdir: mockMkdir }))

const { mockWriteFailureNote, mockReadFailureNotes, mockUpdateSprintStatus } = vi.hoisted(() => ({
  mockWriteFailureNote: vi.fn().mockResolvedValue('/workspace/failures/attempt-1.md'),
  mockReadFailureNotes: vi.fn().mockResolvedValue([]),
  mockUpdateSprintStatus: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/workspace/index.js', () => ({
  writeFailureNote: mockWriteFailureNote,
  readFailureNotes: mockReadFailureNotes,
  updateSprintStatus: mockUpdateSprintStatus,
}))

const makeAppConfig = (escalation: string[] = [], maxAttempts = 3) => ({
  models: { default: 'claude-haiku-4-5-20251001', escalation },
  retry: { maxAttempts },
  artifactsPath: '/artifacts',
  workspacePath: '/workspace',
  projectRoot: '/project',
  cost: { tracking: false },
})

describe('runStoryPipeline', () => {
  const mockRunner = {
    run: vi.fn().mockResolvedValue({
      success: true,
      output: '',
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
    }),
  }
  const mockStateManager = { updateStory: vi.fn().mockResolvedValue(undefined) }
  const mockLog = vi.fn()
  const mockLogError = vi.fn()

  const mockCostTracker = {
    record: vi.fn(),
    getStoryCost: vi.fn().mockReturnValue(0),
    updateStoryCostInState: vi.fn().mockResolvedValue(undefined),
  }

  const baseOpts = {
    epicKey: 'epic-1',
    storyKey: '1-1',
    runner: mockRunner,
    stateManager: mockStateManager as never,
    workspacePath: '/workspace',
    projectRoot: '/project',
    storiesPath: '/stories',
    implementationPath: '/implementation',
    appConfig: makeAppConfig(),
    costTracker: mockCostTracker as never,
    log: mockLog,
    logError: mockLogError,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.endsWith('review.md')) {
        return Promise.resolve('APPROVED\n\nAll criteria met.')
      }
      return Promise.resolve('mock system prompt content')
    })
    mockRunner.run.mockResolvedValue({
      success: true,
      output: '',
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-haiku-4-5-20251001' },
    })
    mockWriteFailureNote.mockResolvedValue('/workspace/failures/attempt-1.md')
    mockReadFailureNotes.mockResolvedValue([])
  })

  // --- Existing happy-path tests ---

  it('returns "completed" when all 4 phases succeed', async () => {
    const result = await runStoryPipeline(baseOpts)
    expect(result).toBe('completed')
    expect(mockRunner.run).toHaveBeenCalledTimes(4)
    expect(mockStateManager.updateStory).toHaveBeenCalledWith('epic-1', '1-1', {
      status: 'completed',
      phase: 'completed',
    })
  })

  it('returns "failed" when storyCreation fails and stops dispatching remaining phases', async () => {
    mockRunner.run.mockResolvedValueOnce({
      success: false,
      output: 'story creation failed',
      errorCategory: ErrorCategory.Capability,
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
    })

    const result = await runStoryPipeline(baseOpts)
    expect(result).toBe('failed')
    expect(mockRunner.run).toHaveBeenCalledTimes(1)
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('returns "failed" when codeReview result contains CHANGES REQUESTED and does not dispatch qa', async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.endsWith('review.md')) {
        return Promise.resolve('CHANGES REQUESTED\n\nPlease fix these issues.')
      }
      return Promise.resolve('mock system prompt content')
    })

    const result = await runStoryPipeline(baseOpts)
    expect(result).toBe('failed')
    // storyCreation, development, codeReview dispatched — qa NOT dispatched
    expect(mockRunner.run).toHaveBeenCalledTimes(3)
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ status: 'failed', phase: 'codeReview' }),
    )
  })

  it('dispatches qa phase when review.md contains APPROVED', async () => {
    const result = await runStoryPipeline(baseOpts)
    expect(result).toBe('completed')
    expect(mockRunner.run).toHaveBeenCalledTimes(4)
  })

  it('calls log twice per phase (dispatch + completion) plus once on story completion, logError not called on success', async () => {
    await runStoryPipeline(baseOpts)
    expect(mockLog).toHaveBeenCalledTimes(9) // 4 dispatches + 4 phase completions + 1 story completion
    expect(mockLogError).not.toHaveBeenCalled()
  })

  // --- Escalation tests ---

  it('retries with same model on Transient error, then succeeds', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockRunner.run
      .mockResolvedValueOnce({
        success: false,
        output: 'timeout',
        errorCategory: ErrorCategory.Transient,
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
      })
      .mockResolvedValue({
        success: true,
        output: '',
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-haiku-4-5-20251001' },
      })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('completed')
    // First phase retried once (2 dispatches), remaining 3 phases succeed (3 dispatches) = 5 total
    expect(mockRunner.run).toHaveBeenCalledTimes(5)
    // First two calls should use the default model (same tier after Transient retry)
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    )
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    )
  })

  it('escalates to next model tier on Capability error, then succeeds', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockRunner.run
      .mockResolvedValueOnce({
        success: false,
        output: 'agent could not complete task',
        errorCategory: ErrorCategory.Capability,
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
      })
      .mockResolvedValue({
        success: true,
        output: '',
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-sonnet-4-6' },
      })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('completed')
    // First dispatch tier 0 (haiku), second dispatch tier 1 (sonnet)
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    )
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    )
  })

  it('flags story immediately on Specification error', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockRunner.run.mockResolvedValueOnce({
      success: false,
      output: 'ambiguous specification',
      errorCategory: ErrorCategory.Specification,
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
    })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('failed')
    expect(mockRunner.run).toHaveBeenCalledTimes(1)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('flagged for human attention'),
    )
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('throws AgentError on System error', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockRunner.run.mockResolvedValueOnce({
      success: false,
      output: 'file system error',
      errorCategory: ErrorCategory.System,
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
    })

    await expect(runStoryPipeline({ ...baseOpts, appConfig })).rejects.toThrow('System error')
  })

  it('flags story when max attempts exhausted', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 2)
    mockRunner.run.mockResolvedValue({
      success: false,
      output: 'timeout',
      errorCategory: ErrorCategory.Transient,
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
    })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('failed')
    // Attempt 1 → retry (under maxAttempts=2). Attempt 2 → flag (at maxAttempts=2).
    expect(mockRunner.run).toHaveBeenCalledTimes(2)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('flagged for human attention'),
    )
  })

  it('includes failure notes in system prompt on retry', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockReadFailureNotes.mockResolvedValue(['## Failure Note\n\nPrevious error details'])
    mockRunner.run
      .mockResolvedValueOnce({
        success: false,
        output: 'timeout',
        errorCategory: ErrorCategory.Transient,
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
      })
      .mockResolvedValue({
        success: true,
        output: '',
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-haiku-4-5-20251001' },
      })

    await runStoryPipeline({ ...baseOpts, appConfig })

    // Second call (retry) should have failure context in systemPrompt
    const secondCallArgs = mockRunner.run.mock.calls[1][0]
    expect(secondCallArgs.systemPrompt).toContain('## Previous Failure Context')
    expect(secondCallArgs.systemPrompt).toContain('Previous error details')
  })

  it('escalates to next model tier when code review requests changes, re-runs development, then completes', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 10)
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.endsWith('review.md')) {
        // First codeReview dispatch is runner call #3; second is call #5 (after development re-run)
        return mockRunner.run.mock.calls.length === 3
          ? Promise.resolve('CHANGES REQUESTED\n\nPlease fix these issues.')
          : Promise.resolve('APPROVED\n\nAll criteria met.')
      }
      return Promise.resolve('mock system prompt content')
    })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('completed')
    // storyCreation(1) + development(2) + codeReview attempt 1(3) + development re-run(4) + codeReview attempt 2(5) + qa(6)
    expect(mockRunner.run).toHaveBeenCalledTimes(6)
    // development re-run (4th dispatch) should use the escalated model
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    )
    // codeReview retry (5th dispatch) should also use the escalated model
    expect(mockRunner.run).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    )
  })

  it('flags story when CHANGES REQUESTED exhausts all model tiers', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 3)
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.endsWith('review.md')) {
        return Promise.resolve('CHANGES REQUESTED\n\nPlease fix these issues.')
      }
      return Promise.resolve('mock system prompt content')
    })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('failed')
    // storyCreation(1) + development(2) + codeReview CHANGES_REQUESTED(3, failureCount=1→escalate) +
    // development re-run(4) + codeReview CHANGES_REQUESTED(5, failureCount=2→flag: all tiers exhausted)
    expect(mockRunner.run).toHaveBeenCalledTimes(5)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('flagged for human attention'),
    )
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ status: 'failed', phase: 'codeReview' }),
    )
  })

  it('successful phases do not consume retry budget', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 3)
    let codeReviewCallCount = 0
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.endsWith('review.md')) {
        codeReviewCallCount++
        // First code review requests changes, second approves
        return codeReviewCallCount === 1
          ? Promise.resolve('CHANGES REQUESTED\n\nPlease fix these issues.')
          : Promise.resolve('APPROVED\n\nAll criteria met.')
      }
      return Promise.resolve('mock system prompt content')
    })

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('completed')
    // storyCreation(1) + development(2) + codeReview CHANGES_REQUESTED(3, failureCount=1→escalate) +
    // development re-run(4) + codeReview APPROVED(5) + qa(6) = 6 dispatches
    expect(mockRunner.run).toHaveBeenCalledTimes(6)
    // With the old bug, storyAttempts would be 3 at the first codeReview, immediately triggering flag.
    // With failureCount, only the CHANGES REQUESTED counts as a failure (failureCount=1),
    // so the story gets retried and eventually completes.
  })

  it('calls costTracker.record() once per phase with result.cost', async () => {
    await runStoryPipeline(baseOpts)
    expect(mockCostTracker.record).toHaveBeenCalledTimes(4)
    expect(mockCostTracker.record).toHaveBeenCalledWith(
      '1-1',
      { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-haiku-4-5-20251001' },
    )
  })

  it('passes costTracker.getStoryCost() result to updateStory on success', async () => {
    mockCostTracker.getStoryCost.mockReturnValue(0.04)
    await runStoryPipeline(baseOpts)
    // Final per-phase success update on last phase includes cost
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ cost: 0.04 }),
    )
  })

  it('passes costTracker.getStoryCost() result to updateStory on phase failure', async () => {
    mockCostTracker.getStoryCost.mockReturnValue(0.05)
    mockRunner.run.mockResolvedValueOnce({
      success: false,
      output: 'agent failed',
      errorCategory: ErrorCategory.Capability,
      cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.05, modelUsed: 'claude-haiku-4-5-20251001' },
    })
    await runStoryPipeline(baseOpts)
    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({ cost: 0.05 }),
    )
  })

  it('uses per-agent model override instead of escalation tier model', async () => {
    const appConfig = {
      ...makeAppConfig(['claude-sonnet-4-6'], 5),
      agents: { development: { model: 'glm-4.7', env: { ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic' } } },
    }

    const result = await runStoryPipeline({ ...baseOpts, appConfig })
    expect(result).toBe('completed')
    // development is the 2nd phase (index 1), so 2nd runner.run call
    const devCallArgs = mockRunner.run.mock.calls[1][0]
    expect(devCallArgs.model).toBe('glm-4.7')
    // Other phases should use the default model
    expect(mockRunner.run.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001')
    expect(mockRunner.run.mock.calls[2][0].model).toBe('claude-haiku-4-5-20251001')
    expect(mockRunner.run.mock.calls[3][0].model).toBe('claude-haiku-4-5-20251001')
  })

  it('skips storyCreation when startPhase is "development"', async () => {
    const result = await runStoryPipeline({ ...baseOpts, startPhase: 'development' })
    expect(result).toBe('completed')
    // development, codeReview, qa = 3 phases (storyCreation skipped)
    expect(mockRunner.run).toHaveBeenCalledTimes(3)
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('development agent for story'),
    )
  })

  it('skips storyCreation and development when startPhase is "codeReview"', async () => {
    const result = await runStoryPipeline({ ...baseOpts, startPhase: 'codeReview' })
    expect(result).toBe('completed')
    // codeReview, qa = 2 phases
    expect(mockRunner.run).toHaveBeenCalledTimes(2)
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('codeReview agent for story'),
    )
  })

  it('runs all 4 phases when startPhase is undefined (default)', async () => {
    const result = await runStoryPipeline({ ...baseOpts, startPhase: undefined })
    expect(result).toBe('completed')
    expect(mockRunner.run).toHaveBeenCalledTimes(4)
  })

  it('runs all phases when startPhase is unknown value not in PHASES', async () => {
    const result = await runStoryPipeline({ ...baseOpts, startPhase: 'unknown' as never })
    expect(result).toBe('completed')
    expect(mockRunner.run).toHaveBeenCalledTimes(4)
  })

  it('loads existing failure notes on first attempt of retried phase when startPhase is set', async () => {
    mockReadFailureNotes.mockResolvedValue(['## Prior Failure\n\nPrevious run error details'])
    const result = await runStoryPipeline({ ...baseOpts, startPhase: 'development' })
    expect(result).toBe('completed')
    // First dispatch (development, first attempt) should include prior failure context in systemPrompt
    const firstCallArgs = mockRunner.run.mock.calls[0][0]
    expect(firstCallArgs.systemPrompt).toContain('## Previous Failure Context')
    expect(firstCallArgs.systemPrompt).toContain('Previous run error details')
  })

  it('prepends CLAUDE.md content to system prompt when claudeMdContent is provided', async () => {
    const result = await runStoryPipeline({
      ...baseOpts,
      claudeMdContent: '# Project Rules\n\nAlways use snake_case.',
    })
    expect(result).toBe('completed')
    // Every phase dispatch should have the CLAUDE.md prefix
    for (const call of mockRunner.run.mock.calls) {
      expect(call[0].systemPrompt).toMatch(/^## Project Context \(CLAUDE\.md\)/)
      expect(call[0].systemPrompt).toContain('Always use snake_case.')
    }
  })

  it('does not prepend CLAUDE.md prefix when claudeMdContent is undefined', async () => {
    await runStoryPipeline(baseOpts)
    for (const call of mockRunner.run.mock.calls) {
      expect(call[0].systemPrompt).not.toContain('## Project Context (CLAUDE.md)')
    }
  })

  it('updates escalationTier and failureNote in state on failure', async () => {
    const appConfig = makeAppConfig(['claude-sonnet-4-6'], 5)
    mockWriteFailureNote.mockResolvedValue('/workspace/failures/1-1-attempt-1.md')
    mockRunner.run
      .mockResolvedValueOnce({
        success: false,
        output: 'agent failed',
        errorCategory: ErrorCategory.Capability,
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0, modelUsed: 'claude-haiku-4-5-20251001' },
      })
      .mockResolvedValue({
        success: true,
        output: '',
        cost: { inputTokens: 0, outputTokens: 0, totalCostUsd: 0.01, modelUsed: 'claude-sonnet-4-6' },
      })

    await runStoryPipeline({ ...baseOpts, appConfig })

    expect(mockStateManager.updateStory).toHaveBeenCalledWith(
      'epic-1',
      '1-1',
      expect.objectContaining({
        failureNote: '/workspace/failures/1-1-attempt-1.md',
        escalationTier: 0,
      }),
    )
  })
})
