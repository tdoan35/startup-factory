import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerBuildCommand } from './build-command.js'

const mockConfig = {
  models: { default: 'claude-sonnet-4-6', escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'] },
  retry: { maxAttempts: 3 },
  artifactsPath: './planning-artifacts',
  workspacePath: '.startup-factory',
  projectRoot: '.',
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
  mockParseEpicRange,
  mockFilterEpicsByRange,
  mockParseStoryRange,
  mockFilterEpicsByStoryRange,
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
  MockWorkspaceManager: Object.assign(vi.fn(), {
    resolveArtifactsPath: vi.fn().mockImplementation((p: string) => Promise.resolve(p)),
  }),
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
  mockParseEpicRange: vi.fn(),
  mockFilterEpicsByRange: vi.fn(),
  mockParseStoryRange: vi.fn(),
  mockFilterEpicsByStoryRange: vi.fn(),
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
const { mockReadSprintStatus, mockReadFile } = vi.hoisted(() => ({
  mockReadSprintStatus: vi.fn().mockResolvedValue(new Map()),
  mockReadFile: vi.fn().mockResolvedValue('mock claude md content'),
}))

const { mockMkdir } = vi.hoisted(() => ({ mockMkdir: vi.fn().mockResolvedValue(undefined) }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, readFile: mockReadFile, mkdir: mockMkdir }
})

vi.mock('@/workspace/index.js', () => ({
  WorkspaceManager: MockWorkspaceManager,
  StateManager: MockStateManager,
  parseEpicsFromArtifacts: mockParseEpicsFromArtifacts,
  parseEpicRange: mockParseEpicRange,
  filterEpicsByRange: mockFilterEpicsByRange,
  parseStoryRange: mockParseStoryRange,
  filterEpicsByStoryRange: mockFilterEpicsByStoryRange,
  readSprintStatus: mockReadSprintStatus,
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
    MockWorkspaceManager.resolveArtifactsPath.mockImplementation((p: string) => Promise.resolve(p))
    mockWorkspaceManager.validateArtifacts.mockResolvedValue({ valid: true, requiredFound: [], missingRequired: [], optionalFound: [] })
    mockReadSprintStatus.mockResolvedValue(new Map())
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
    expect(optionLongs).toContain('--project-root')
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

  it('registers --claude-md option', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')!
    const optionLongs = buildCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--claude-md')
  })

  it('passes --claude-md to mergeCliFlags as claudeMdPath', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--claude-md', './CLAUDE.md'])

    expect(mockMergeCliFlags).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ claudeMdPath: './CLAUDE.md' }),
    )
  })

  it('registers --epics option', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')!
    const optionLongs = buildCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--epics')
  })

  it('filters epics when --epics flag is provided', async () => {
    const allEpics = [
      { epicKey: 'epic-1', storyKeys: ['1-1'] },
      { epicKey: 'epic-2', storyKeys: ['2-1'] },
      { epicKey: 'epic-3', storyKeys: ['3-1'] },
    ]
    mockParseEpicsFromArtifacts.mockResolvedValue(allEpics)
    mockParseEpicRange.mockReturnValue({ from: 1, to: 1 })
    mockFilterEpicsByRange.mockReturnValue([allEpics[0]])

    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--epics', '1'])

    expect(mockParseEpicRange).toHaveBeenCalledWith('1')
    expect(mockFilterEpicsByRange).toHaveBeenCalledWith(allEpics, { from: 1, to: 1 })
    expect(mockStateManager.initialize).toHaveBeenCalledWith(
      [allEpics[0]],
      expect.anything(),
      expect.anything(),
    )
  })

  it('calls process.exit(2) when --epics matches no epics', async () => {
    mockParseEpicsFromArtifacts.mockResolvedValue([{ epicKey: 'epic-1', storyKeys: ['1-1'] }])
    mockParseEpicRange.mockReturnValue({ from: 99, to: 99 })
    mockFilterEpicsByRange.mockReturnValue([])

    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--epics', '99'])

    expect(mockLogError).toHaveBeenCalledWith('No epics match range "99"')
    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('registers --story option', () => {
    const program = new Command()
    registerBuildCommand(program)
    const buildCmd = program.commands.find(cmd => cmd.name() === 'build')!
    const optionLongs = buildCmd.options.map(o => o.long)
    expect(optionLongs).toContain('--story')
  })

  it('filters stories when --story flag is provided', async () => {
    const allEpics = [
      { epicKey: 'epic-1', storyKeys: ['1-1', '1-2', '1-3'] },
      { epicKey: 'epic-2', storyKeys: ['2-1'] },
    ]
    const filteredEpics = [
      { epicKey: 'epic-1', storyKeys: ['1-1', '1-2', '1-3'] },
    ]
    mockParseEpicsFromArtifacts.mockResolvedValue(allEpics)
    mockParseStoryRange.mockReturnValue({ from: { epic: 1, story: 1 }, to: { epic: 1, story: 3 } })
    mockFilterEpicsByStoryRange.mockReturnValue(filteredEpics)

    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--story', '1-1', '1-3'])

    expect(mockParseStoryRange).toHaveBeenCalledWith(['1-1', '1-3'])
    expect(mockFilterEpicsByStoryRange).toHaveBeenCalledWith(allEpics, { from: { epic: 1, story: 1 }, to: { epic: 1, story: 3 } })
    expect(mockStateManager.initialize).toHaveBeenCalledWith(
      filteredEpics,
      expect.anything(),
      expect.anything(),
    )
  })

  it('calls process.exit(2) when --story matches no stories', async () => {
    mockParseEpicsFromArtifacts.mockResolvedValue([{ epicKey: 'epic-1', storyKeys: ['1-1'] }])
    mockParseStoryRange.mockReturnValue({ from: { epic: 99, story: 1 }, to: { epic: 99, story: 1 } })
    mockFilterEpicsByStoryRange.mockReturnValue([])

    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--story', '99-1'])

    expect(mockLogError).toHaveBeenCalledWith('No stories match range "99-1"')
    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('calls process.exit(2) when both --story and --epics are provided', async () => {
    const program = new Command()
    program.exitOverride()
    registerBuildCommand(program)

    await program.parseAsync(['node', 'sf', 'build', './artifacts', '--epics', '1', '--story', '1-1'])

    expect(mockLogError).toHaveBeenCalledWith('--story and --epics are mutually exclusive')
    expect(process.exit).toHaveBeenCalledWith(2)
  })
})
