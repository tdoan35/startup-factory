import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerStatusCommand, formatStatusOutput } from './status-command.js'
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

describe('registerStatusCommand', () => {
  it('registers status command on a Commander program without error', () => {
    const program = new Command()
    expect(() => registerStatusCommand(program)).not.toThrow()
  })

  it('creates a status command with the correct name', () => {
    const program = new Command()
    registerStatusCommand(program)
    const statusCmd = program.commands.find(cmd => cmd.name() === 'status')
    expect(statusCmd).toBeDefined()
    expect(statusCmd!.description()).toBe('Show current build status')
  })

  it('registers --workspace-path and --config options', () => {
    const program = new Command()
    registerStatusCommand(program)
    const statusCmd = program.commands.find(cmd => cmd.name() === 'status')!
    const optionNames = statusCmd.options.map(o => o.long)
    expect(optionNames).toContain('--workspace-path')
    expect(optionNames).toContain('--config')
  })
})

describe('formatStatusOutput', () => {
  it('displays all-completed state', () => {
    const state = makeState({
      run: {
        status: 'completed',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 1.5,
      },
      epics: {
        'epic-1': {
          status: 'completed',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
            '1-2': { status: 'completed', phase: 'completed', attempts: 1, cost: 1.0 },
          },
        },
      },
    })

    const output = formatStatusOutput(state)
    expect(output).toContain('=== BUILD STATUS ===')
    expect(output).toContain('Run Status: completed')
    expect(output).toContain('Started: 2026-03-06T22:00:00Z')
    expect(output).toContain('Completed: 2')
    expect(output).toContain('Failed: 0')
    expect(output).toContain('In Progress: 0')
    expect(output).toContain('Pending: 0')
    expect(output).not.toContain('Failed Stories:')
  })

  it('displays partial state with failed stories', () => {
    const state = makeState({
      run: {
        status: 'partial',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 2.0,
      },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 1.0 },
            '1-2': { status: 'failed', phase: 'development', attempts: 3, cost: 0.5 },
          },
        },
        'epic-2': {
          status: 'in-progress',
          stories: {
            '2-1': { status: 'failed', phase: 'qa', attempts: 2, cost: 0.5 },
          },
        },
      },
    })

    const output = formatStatusOutput(state)
    expect(output).toContain('Run Status: partial')
    expect(output).toContain('Completed: 1')
    expect(output).toContain('Failed: 2')
    expect(output).toContain('Failed Stories:')
    expect(output).toContain('1-2 (development)')
    expect(output).toContain('2-1 (qa)')
  })

  it('displays all-pending state', () => {
    const state = makeState({
      run: {
        status: 'running',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 0,
      },
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

    const output = formatStatusOutput(state)
    expect(output).toContain('Run Status: running')
    expect(output).toContain('Completed: 0')
    expect(output).toContain('Pending: 2')
    expect(output).not.toContain('Failed Stories:')
  })

  it('displays mixed state with all statuses', () => {
    const state = makeState({
      run: {
        status: 'running',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 1.0,
      },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
            '1-2': { status: 'in-progress', phase: 'development', attempts: 1, cost: 0.2 },
            '1-3': { status: 'failed', phase: 'codeReview', attempts: 3, cost: 0.3 },
          },
        },
        'epic-2': {
          status: 'pending',
          stories: {
            '2-1': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
          },
        },
      },
    })

    const output = formatStatusOutput(state)
    expect(output).toContain('Completed: 1')
    expect(output).toContain('Failed: 1')
    expect(output).toContain('In Progress: 1')
    expect(output).toContain('Pending: 1')
    expect(output).toContain('Failed Stories:')
    expect(output).toContain('1-3 (codeReview)')
  })

  it('handles empty epics', () => {
    const state = makeState()
    const output = formatStatusOutput(state)
    expect(output).toContain('=== BUILD STATUS ===')
    expect(output).toContain('Completed: 0')
    expect(output).toContain('Failed: 0')
  })

  it('output ends with newline', () => {
    const state = makeState()
    const output = formatStatusOutput(state)
    expect(output.endsWith('\n')).toBe(true)
  })

  it('displays failureNote path for failed stories when available', () => {
    const state = makeState({
      run: {
        status: 'partial',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 1.0,
      },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': {
              status: 'failed',
              phase: 'development',
              attempts: 3,
              cost: 0.5,
              failureNote: '/workspace/failures/1-1-attempt-3.md',
            },
            '1-2': { status: 'failed', phase: 'qa', attempts: 2, cost: 0.3 },
          },
        },
      },
    })

    const output = formatStatusOutput(state)
    expect(output).toContain('1-1 (development): /workspace/failures/1-1-attempt-3.md')
    expect(output).toContain('1-2 (qa)')
    expect(output).not.toContain('1-2 (qa):')
  })
})

describe('status command action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(mockConfig)
    MockStateManager.mockImplementation(function () {
      return { read: mockRead }
    })
  })

  it('outputs formatted status when state file exists', async () => {
    const mockState = makeState({
      epics: {
        'epic-1': {
          status: 'completed',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
          },
        },
      },
    })
    mockRead.mockResolvedValue(mockState)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)
    await program.parseAsync(['node', 'sf', 'status'])

    expect(mockLoadConfig).toHaveBeenCalledOnce()
    expect(mockRead).toHaveBeenCalledOnce()
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('=== BUILD STATUS ==='))
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: 1'))
    writeSpy.mockRestore()
  })

  it('outputs "No build data found" when state file does not exist', async () => {
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException
    enoent.code = 'ENOENT'
    mockRead.mockRejectedValue(enoent)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)
    await program.parseAsync(['node', 'sf', 'status'])

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('No build data found'))
    writeSpy.mockRestore()
  })

  it('rethrows non-ENOENT errors', async () => {
    mockRead.mockRejectedValue(new Error('disk failure'))

    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)

    await expect(program.parseAsync(['node', 'sf', 'status'])).rejects.toThrow('disk failure')
  })

  it('passes --config to loadConfig', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)
    await program.parseAsync(['node', 'sf', 'status', '--config', './custom.yaml'])

    expect(mockLoadConfig).toHaveBeenCalledWith('./custom.yaml')
    vi.mocked(process.stdout.write).mockRestore()
  })

  it('uses --workspace-path when provided', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerStatusCommand(program)
    await program.parseAsync(['node', 'sf', 'status', '--workspace-path', '/custom/workspace'])

    expect(MockStateManager).toHaveBeenCalledWith(expect.stringContaining('/custom/workspace'))
    vi.mocked(process.stdout.write).mockRestore()
  })
})
