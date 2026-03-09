import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerNextCommand, formatNextAction } from './next-command.js'
import type { AppState } from '@/workspace/types.js'

function makeState(overrides?: Partial<AppState>): AppState {
  return {
    run: {
      status: 'completed',
      started: '2026-03-06T22:00:00Z',
      config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
      totalCost: 0,
    },
    epics: {},
    ...overrides,
  }
}

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
  mockRead,
  MockStateManager,
} = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockRead: vi.fn(),
  MockStateManager: vi.fn(),
}))

vi.mock('@/config/index.js', () => ({
  loadConfig: mockLoadConfig,
}))

vi.mock('@/workspace/index.js', () => ({
  StateManager: MockStateManager,
}))

describe('registerNextCommand', () => {
  it('registers next command on a Commander program without error', () => {
    const program = new Command()
    expect(() => registerNextCommand(program)).not.toThrow()
  })

  it('creates a next command with the correct name', () => {
    const program = new Command()
    registerNextCommand(program)
    const nextCmd = program.commands.find(cmd => cmd.name() === 'next')
    expect(nextCmd).toBeDefined()
    expect(nextCmd!.description()).toBe('Suggest the next build action')
  })

  it('registers --workspace-path and --config options', () => {
    const program = new Command()
    registerNextCommand(program)
    const nextCmd = program.commands.find(cmd => cmd.name() === 'next')!
    const optionNames = nextCmd.options.map(o => o.long)
    expect(optionNames).toContain('--workspace-path')
    expect(optionNames).toContain('--config')
  })
})

describe('formatNextAction', () => {
  it('returns running message when build is running', () => {
    const state = makeState({ run: { ...makeState().run, status: 'running' } })
    expect(formatNextAction(state)).toBe('Build is currently running.\n')
  })

  it('returns completed message when run status is completed', () => {
    const state = makeState({ run: { ...makeState().run, status: 'completed' } })
    expect(formatNextAction(state)).toBe('All stories completed. Nothing to do.\n')
  })

  it('suggests resume when there are in-progress stories', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'in-progress', phase: 'development', attempts: 1, cost: 0.2 },
            '1-2': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('Build was interrupted')
    expect(output).toContain('startup-factory build <artifact-path>')
  })

  it('suggests retry for first failed story', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
            '1-2': { status: 'failed', phase: 'development', attempts: 3, cost: 0.3 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('startup-factory retry 1-2')
  })

  it('shows remaining failure count when multiple stories failed', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'failed', phase: 'development', attempts: 3, cost: 0.3 },
            '1-2': { status: 'failed', phase: 'qa', attempts: 2, cost: 0.2 },
          },
        },
        'epic-2': {
          status: 'in-progress',
          stories: {
            '2-1': { status: 'failed', phase: 'codeReview', attempts: 1, cost: 0.1 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('startup-factory retry 1-1')
    expect(output).toContain('2 more failed stories remaining')
  })

  it('uses singular "story" when only one more failure remains', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'failed', phase: 'development', attempts: 3, cost: 0.3 },
            '1-2': { status: 'failed', phase: 'qa', attempts: 2, cost: 0.2 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('1 more failed story remaining')
  })

  it('suggests build when only pending stories remain', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'failed' },
      epics: {
        'epic-1': {
          status: 'pending',
          stories: {
            '1-1': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
            '1-2': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('Build has pending stories')
    expect(output).toContain('startup-factory build <artifact-path>')
  })

  it('returns completed when no stories exist and run is not running', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'failed' },
      epics: {},
    })
    expect(formatNextAction(state)).toBe('All stories completed. Nothing to do.\n')
  })

  it('prioritizes in-progress over failed stories', () => {
    const state = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'in-progress', phase: 'development', attempts: 1, cost: 0.2 },
            '1-2': { status: 'failed', phase: 'qa', attempts: 3, cost: 0.3 },
          },
        },
      },
    })
    const output = formatNextAction(state)
    expect(output).toContain('Build was interrupted')
    expect(output).not.toContain('retry')
  })

  it('output ends with newline', () => {
    const state = makeState()
    expect(formatNextAction(state).endsWith('\n')).toBe(true)
  })
})

describe('next command action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(mockConfig)
    MockStateManager.mockImplementation(function () {
      return { read: mockRead }
    })
  })

  it('outputs formatted next action when state file exists', async () => {
    const mockState = makeState({
      run: { ...makeState().run, status: 'partial' },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'failed', phase: 'development', attempts: 3, cost: 0.3 },
          },
        },
      },
    })
    mockRead.mockResolvedValue(mockState)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerNextCommand(program)
    await program.parseAsync(['node', 'sf', 'next'])

    expect(mockLoadConfig).toHaveBeenCalledOnce()
    expect(mockRead).toHaveBeenCalledOnce()
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('startup-factory retry 1-1'))
    writeSpy.mockRestore()
  })

  it('outputs "No build found" when state file does not exist', async () => {
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException
    enoent.code = 'ENOENT'
    mockRead.mockRejectedValue(enoent)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerNextCommand(program)
    await program.parseAsync(['node', 'sf', 'next'])

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('No build found'))
    writeSpy.mockRestore()
  })

  it('rethrows non-ENOENT errors', async () => {
    mockRead.mockRejectedValue(new Error('disk failure'))

    const program = new Command()
    program.exitOverride()
    registerNextCommand(program)

    await expect(program.parseAsync(['node', 'sf', 'next'])).rejects.toThrow('disk failure')
  })

  it('passes --config to loadConfig', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerNextCommand(program)
    await program.parseAsync(['node', 'sf', 'next', '--config', './custom.yaml'])

    expect(mockLoadConfig).toHaveBeenCalledWith('./custom.yaml')
    vi.mocked(process.stdout.write).mockRestore()
  })

  it('uses --workspace-path when provided', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerNextCommand(program)
    await program.parseAsync(['node', 'sf', 'next', '--workspace-path', '/custom/workspace'])

    expect(MockStateManager).toHaveBeenCalledWith(expect.stringContaining('/custom/workspace'))
    vi.mocked(process.stdout.write).mockRestore()
  })
})
