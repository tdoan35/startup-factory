import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerRetryCommand } from './retry-command.js'

const mockConfig = {
  models: { default: 'claude-sonnet-4-6', escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'] },
  retry: { maxAttempts: 3 },
  artifactsPath: './planning-artifacts',
  workspacePath: '.startup-factory',
  cost: { tracking: true },
}

const {
  mockLoadConfig,
  mockMergeCliFlags,
  mockGetStoryByKey,
  mockUpdateStory,
  MockStateManager,
  MockClaudeAgentRunner,
  mockRunStoryPipeline,
  mockLog,
  mockLogError,
  mockComputeExitCode,
} = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockMergeCliFlags: vi.fn(),
  mockGetStoryByKey: vi.fn(),
  mockUpdateStory: vi.fn().mockResolvedValue(undefined),
  MockStateManager: vi.fn(),
  MockClaudeAgentRunner: vi.fn(),
  mockRunStoryPipeline: vi.fn(),
  mockLog: vi.fn(),
  mockLogError: vi.fn(),
  mockComputeExitCode: vi.fn(),
}))

vi.mock('@/config/index.js', () => ({
  loadConfig: mockLoadConfig,
  mergeCliFlags: mockMergeCliFlags,
}))

vi.mock('@/workspace/index.js', () => ({
  StateManager: MockStateManager,
}))

vi.mock('@/orchestrator/index.js', () => ({
  runStoryPipeline: mockRunStoryPipeline,
}))

vi.mock('@/agents/index.js', () => ({
  ClaudeAgentRunner: MockClaudeAgentRunner,
}))

vi.mock('@/errors/agent-error.js', () => ({
  computeExitCode: mockComputeExitCode,
}))

vi.mock('@/output/logger.js', () => ({
  log: mockLog,
  logError: mockLogError,
}))

describe('registerRetryCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(mockConfig)
    mockMergeCliFlags.mockReturnValue(mockConfig)
    MockStateManager.mockImplementation(function() {
      return { getStoryByKey: mockGetStoryByKey, updateStory: mockUpdateStory }
    })
    MockClaudeAgentRunner.mockImplementation(function() { return {} })
    mockGetStoryByKey.mockResolvedValue(null)
    mockComputeExitCode.mockReturnValue(0)
    mockRunStoryPipeline.mockResolvedValue('completed')
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  })

  it('registers retry command on a Commander program without error', () => {
    const program = new Command()
    expect(() => registerRetryCommand(program)).not.toThrow()
  })

  it('creates a retry command with the correct name and description', () => {
    const program = new Command()
    registerRetryCommand(program)
    const retryCmd = program.commands.find(cmd => cmd.name() === 'retry')
    expect(retryCmd).toBeDefined()
    expect(retryCmd!.description()).toBe('Retry a failed story')
  })

  it('registers all required CLI options', () => {
    const program = new Command()
    registerRetryCommand(program)
    const retryCmd = program.commands.find(cmd => cmd.name() === 'retry')!
    const optionLongs = retryCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--max-retries')
    expect(optionLongs).toContain('--model')
    expect(optionLongs).toContain('--config')
  })

  it('calls loadConfig and mergeCliFlags in action', async () => {
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', 'story-1-2'])

    expect(mockLoadConfig).toHaveBeenCalledOnce()
    expect(mockMergeCliFlags).toHaveBeenCalledOnce()
  })

  it('passes --config path to loadConfig', async () => {
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', 'story-1-2', '--config', './custom.yaml'])

    expect(mockLoadConfig).toHaveBeenCalledWith('./custom.yaml')
  })

  it('passes --max-retries to mergeCliFlags', async () => {
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', 'story-1-2', '--max-retries', '7'])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ maxRetries: 7 }),
    )
  })

  it('passes --model to mergeCliFlags', async () => {
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', 'story-1-2', '--model', 'claude-opus-4-6'])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ model: 'claude-opus-4-6' }),
    )
  })

  it('calls logError and process.exit(2) when story not found in state', async () => {
    mockGetStoryByKey.mockResolvedValue(null)
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', 'unknown-story'])

    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('not found'))
    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('logs warning and calls process.exit(0) when story is already completed', async () => {
    mockGetStoryByKey.mockResolvedValue({
      epicKey: 'epic-1',
      storyKey: '1-2',
      status: 'completed',
      phase: 'completed',
      attempts: 3,
      cost: 0.5,
    })
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '1-2'])

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('already completed'))
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(mockRunStoryPipeline).not.toHaveBeenCalled()
  })

  it('calls updateStory to reset and runStoryPipeline with startPhase from failed story', async () => {
    const failedStory = {
      epicKey: 'epic-1',
      storyKey: '1-2',
      status: 'failed' as const,
      phase: 'development' as const,
      attempts: 2,
      cost: 0.3,
    }
    mockGetStoryByKey.mockResolvedValue(failedStory)
    mockRunStoryPipeline.mockResolvedValue('completed')
    mockComputeExitCode.mockReturnValue(0)

    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '1-2'])

    expect(mockUpdateStory).toHaveBeenCalledWith('epic-1', '1-2', {
      status: 'pending',
      phase: 'pending',
      attempts: 0,
    })
    expect(mockRunStoryPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        epicKey: 'epic-1',
        storyKey: '1-2',
        startPhase: 'development',
        workspacePath: expect.any(String),
        appConfig: mockConfig,
      }),
    )
  })

  it('logs warning and calls process.exit(0) when story is in-progress', async () => {
    mockGetStoryByKey.mockResolvedValue({
      epicKey: 'epic-1',
      storyKey: '1-3',
      status: 'in-progress',
      phase: 'development',
      attempts: 1,
      cost: 0.2,
    })
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '1-3'])

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('in-progress'))
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(mockRunStoryPipeline).not.toHaveBeenCalled()
  })

  it('passes appConfig and workspacePath from effective config to runStoryPipeline', async () => {
    const failedStory = {
      epicKey: 'epic-2',
      storyKey: '2-1',
      status: 'failed' as const,
      phase: 'codeReview' as const,
      attempts: 1,
      cost: 0.1,
    }
    mockGetStoryByKey.mockResolvedValue(failedStory)
    mockRunStoryPipeline.mockResolvedValue('failed')
    mockComputeExitCode.mockReturnValue(2)

    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '2-1'])

    expect(mockRunStoryPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        epicKey: 'epic-2',
        storyKey: '2-1',
        appConfig: mockConfig,
        startPhase: 'codeReview',
      }),
    )
    expect(mockComputeExitCode).toHaveBeenCalledWith(0, 1)
    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('uses storyCreation as startPhase when story failed at storyCreation phase', async () => {
    mockGetStoryByKey.mockResolvedValue({
      epicKey: 'epic-1',
      storyKey: '1-1',
      status: 'failed',
      phase: 'storyCreation',
      attempts: 1,
      cost: 0.05,
    })
    mockRunStoryPipeline.mockResolvedValue('completed')
    mockComputeExitCode.mockReturnValue(0)
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '1-1'])

    expect(mockRunStoryPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ startPhase: 'storyCreation' }),
    )
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('uses qa as startPhase when story failed at qa phase', async () => {
    mockGetStoryByKey.mockResolvedValue({
      epicKey: 'epic-3',
      storyKey: '3-2',
      status: 'failed',
      phase: 'qa',
      attempts: 2,
      cost: 0.4,
    })
    mockRunStoryPipeline.mockResolvedValue('completed')
    mockComputeExitCode.mockReturnValue(0)
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '3-2'])

    expect(mockRunStoryPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ startPhase: 'qa' }),
    )
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('calls logError and process.exit(2) when runStoryPipeline throws a system error', async () => {
    mockGetStoryByKey.mockResolvedValue({
      epicKey: 'epic-1',
      storyKey: '1-2',
      status: 'failed',
      phase: 'development',
      attempts: 2,
      cost: 0.3,
    })
    mockRunStoryPipeline.mockRejectedValue(new Error('EEXIST: file already exists'))
    const program = new Command()
    program.exitOverride()
    registerRetryCommand(program)

    await program.parseAsync(['node', 'sf', 'retry', '1-2'])

    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('System error'))
    expect(process.exit).toHaveBeenCalledWith(2)
  })
})
