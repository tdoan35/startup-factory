import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerBuildCommand } from './build-command.js'

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
  mockWorkspaceManager,
  MockWorkspaceManager,
  mockStateManager,
  MockStateManager,
  MockClaudeAgentRunner,
  mockRunDispatcher,
  mockLog,
  mockLogError,
  mockComputeExitCode,
  mockParseEpicsFromArtifacts,
  mockBuildCompletionSummary,
  mockFormatSummary,
} = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockMergeCliFlags: vi.fn(),
  mockWorkspaceManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    validateArtifacts: vi.fn().mockResolvedValue({ valid: true, requiredFound: [], missingRequired: [], optionalFound: [] }),
    ingestArtifacts: vi.fn().mockResolvedValue(undefined),
    artifactsPath: '/mock/workspace/artifacts',
  },
  MockWorkspaceManager: vi.fn(),
  mockStateManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    updateRun: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue({
      run: { status: 'completed', started: '2026-03-06T22:00:00Z', config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 }, totalCost: 0 },
      epics: {},
    }),
  },
  MockStateManager: vi.fn(),
  MockClaudeAgentRunner: vi.fn(),
  mockRunDispatcher: vi.fn().mockResolvedValue({ completedCount: 1, failedCount: 0 }),
  mockLog: vi.fn(),
  mockLogError: vi.fn(),
  mockComputeExitCode: vi.fn().mockReturnValue(0),
  mockParseEpicsFromArtifacts: vi.fn().mockResolvedValue([{ epicKey: 'epic-1', storyKeys: ['1-1'] }]),
  mockBuildCompletionSummary: vi.fn().mockReturnValue({
    runStatus: 'completed',
    storiesCompleted: 1,
    storiesFailed: 0,
    storiesPending: 0,
    totalCost: 0,
    failedStories: [],
    startedAt: '2026-03-06T22:00:00Z',
  }),
  mockFormatSummary: vi.fn().mockReturnValue('mock summary output'),
}))

vi.mock('@/config/index.js', () => ({
  loadConfig: mockLoadConfig,
  mergeCliFlags: mockMergeCliFlags,
}))
vi.mock('@/workspace/index.js', () => ({
  WorkspaceManager: MockWorkspaceManager,
  StateManager: MockStateManager,
  parseEpicsFromArtifacts: mockParseEpicsFromArtifacts,
}))
vi.mock('@/orchestrator/dispatcher.js', () => ({ runDispatcher: mockRunDispatcher }))
vi.mock('@/agents/index.js', () => ({ ClaudeAgentRunner: MockClaudeAgentRunner }))
vi.mock('@/output/logger.js', () => ({ log: mockLog, logError: mockLogError }))
vi.mock('@/errors/agent-error.js', () => ({ computeExitCode: mockComputeExitCode }))
vi.mock('@/output/summary.js', () => ({ buildCompletionSummary: mockBuildCompletionSummary, formatSummary: mockFormatSummary }))

describe('registerBuildCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(mockConfig)
    mockMergeCliFlags.mockReturnValue(mockConfig)
    MockWorkspaceManager.mockImplementation(function() { return mockWorkspaceManager })
    MockStateManager.mockImplementation(function() { return mockStateManager })
    MockClaudeAgentRunner.mockImplementation(function() { return {} })
    mockWorkspaceManager.validateArtifacts.mockResolvedValue({ valid: true, requiredFound: [], missingRequired: [], optionalFound: [] })
    mockRunDispatcher.mockResolvedValue({ completedCount: 1, failedCount: 0 })
    mockComputeExitCode.mockReturnValue(0)
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  })

  it('registers build command on a Commander program without error', () => {
    const program = new Command()
    expect(() => registerBuildCommand(program)).not.toThrow()
  })

  it('creates a build command with the correct name and description', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')
    expect(buildCmd).toBeDefined()
    expect(buildCmd!.description()).toBe('Run the full build pipeline')
  })

  it('registers all required CLI options', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')!
    const optionLongs = buildCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--max-retries')
    expect(optionLongs).toContain('--model')
    expect(optionLongs).toContain('--artifacts-path')
    expect(optionLongs).toContain('--workspace-path')
    expect(optionLongs).toContain('--config')
  })

  it('calls loadConfig and mergeCliFlags in action', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts'])

    expect(mockLoadConfig).toHaveBeenCalledOnce()
    expect(mockMergeCliFlags).toHaveBeenCalledOnce()
  })

  it('passes --config path to loadConfig', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--config', './custom.yaml'])

    expect(mockLoadConfig).toHaveBeenCalledWith('./custom.yaml')
  })

  it('passes --max-retries to mergeCliFlags', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--max-retries', '5'])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ maxRetries: 5 }),
    )
  })

  it('uses --artifacts-path flag over positional arg when provided', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync([
      'node', 'sf', 'build', './positional', '--artifacts-path', './flag-path',
    ])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ artifactsPath: './flag-path' }),
    )
  })

  it('uses positional arg as artifactsPath when --artifacts-path not provided', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './positional'])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ artifactsPath: './positional' }),
    )
  })

  it('calls process.exit(2) when artifact validation fails', async () => {
    mockWorkspaceManager.validateArtifacts.mockResolvedValue({
      valid: false,
      requiredFound: [],
      missingRequired: ['epics.md'],
      optionalFound: [],
    })
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts'])

    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('calls process.exit(0) on successful build', async () => {
    mockRunDispatcher.mockResolvedValue({ completedCount: 1, failedCount: 0 })
    mockComputeExitCode.mockReturnValue(0)
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts'])

    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('calls process.exit(1) on partial build', async () => {
    mockRunDispatcher.mockResolvedValue({ completedCount: 1, failedCount: 1 })
    mockComputeExitCode.mockReturnValue(1)
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts'])

    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('registers --output option', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')!
    const optionLongs = buildCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--output')
  })

  it('outputs completion summary to stdout on successful build', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts'])

    expect(mockBuildCompletionSummary).toHaveBeenCalled()
    expect(mockFormatSummary).toHaveBeenCalledWith(
      expect.objectContaining({ runStatus: 'completed' }),
      'text',
    )
    expect(stdoutSpy).toHaveBeenCalledWith('mock summary output')
    stdoutSpy.mockRestore()
  })

  it('passes json format to formatSummary when --output json', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--output', 'json'])

    expect(mockFormatSummary).toHaveBeenCalledWith(expect.anything(), 'json')
    stdoutSpy.mockRestore()
  })

  it('passes yaml format to formatSummary when --output yaml', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--output', 'yaml'])

    expect(mockFormatSummary).toHaveBeenCalledWith(expect.anything(), 'yaml')
    stdoutSpy.mockRestore()
  })

  it('calls process.exit(2) for invalid --output format', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--output', 'xml'])

    expect(mockLogError).toHaveBeenCalledWith('Invalid output format: xml. Use text, json, or yaml.')
    expect(process.exit).toHaveBeenCalledWith(2)
  })
})
