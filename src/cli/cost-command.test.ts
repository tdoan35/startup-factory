import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { registerCostCommand, formatCostOutput } from './cost-command.js'
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

describe('registerCostCommand', () => {
  it('registers cost command on a Commander program without error', () => {
    const program = new Command()
    expect(() => registerCostCommand(program)).not.toThrow()
  })

  it('creates a cost command with the correct name', () => {
    const program = new Command()
    registerCostCommand(program)
    const costCmd = program.commands.find(cmd => cmd.name() === 'cost')
    expect(costCmd).toBeDefined()
    expect(costCmd!.description()).toBe('Show cost summary')
  })

  it('registers --workspace-path and --config options', () => {
    const program = new Command()
    registerCostCommand(program)
    const costCmd = program.commands.find(cmd => cmd.name() === 'cost')!
    const optionNames = costCmd.options.map(o => o.long)
    expect(optionNames).toContain('--workspace-path')
    expect(optionNames).toContain('--config')
  })
})

describe('formatCostOutput', () => {
  it('displays per-story costs and total', () => {
    const state = makeState({
      run: {
        status: 'completed',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 1.87,
      },
      epics: {
        'epic-1': {
          status: 'completed',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.42 },
            '1-2': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.35 },
          },
        },
        'epic-2': {
          status: 'completed',
          stories: {
            '2-1': { status: 'completed', phase: 'completed', attempts: 2, cost: 1.10 },
          },
        },
      },
    })

    const output = formatCostOutput(state)
    expect(output).toContain('=== COST BREAKDOWN ===')
    expect(output).toContain('Per-Story Costs:')
    expect(output).toContain('1-1: $0.42')
    expect(output).toContain('1-2: $0.35')
    expect(output).toContain('2-1: $1.10')
    expect(output).toContain('Total Run Cost: $1.87')
  })

  it('displays zero costs correctly', () => {
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

    const output = formatCostOutput(state)
    expect(output).toContain('1-1: $0.00')
    expect(output).toContain('1-2: $0.00')
    expect(output).toContain('Total Run Cost: $0.00')
  })

  it('displays mixed cost scenarios', () => {
    const state = makeState({
      run: {
        status: 'partial',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 0.75,
      },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.50 },
            '1-2': { status: 'failed', phase: 'development', attempts: 3, cost: 0.25 },
            '1-3': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
          },
        },
      },
    })

    const output = formatCostOutput(state)
    expect(output).toContain('1-1: $0.50')
    expect(output).toContain('1-2: $0.25')
    expect(output).toContain('1-3: $0.00')
    expect(output).toContain('Total Run Cost: $0.75')
  })

  it('handles empty epics', () => {
    const state = makeState()
    const output = formatCostOutput(state)
    expect(output).toContain('=== COST BREAKDOWN ===')
    expect(output).toContain('Total Run Cost: $0.00')
  })

  it('output ends with newline', () => {
    const state = makeState()
    const output = formatCostOutput(state)
    expect(output.endsWith('\n')).toBe(true)
  })

  it('handles undefined cost gracefully', () => {
    const state = makeState({
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'pending', phase: 'pending', attempts: 0, cost: undefined as unknown as number },
          },
        },
      },
    })
    const output = formatCostOutput(state)
    expect(output).toContain('1-1: $0.00')
  })
})

describe('cost command action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadConfig.mockResolvedValue(mockConfig)
    MockStateManager.mockImplementation(function () {
      return { read: mockRead }
    })
  })

  it('outputs formatted cost when state file exists', async () => {
    const mockState = makeState({
      run: {
        status: 'completed',
        started: '2026-03-06T22:00:00Z',
        config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
        totalCost: 0.77,
      },
      epics: {
        'epic-1': {
          status: 'completed',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.77 },
          },
        },
      },
    })
    mockRead.mockResolvedValue(mockState)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerCostCommand(program)
    await program.parseAsync(['node', 'sf', 'cost'])

    expect(mockLoadConfig).toHaveBeenCalledOnce()
    expect(mockRead).toHaveBeenCalledOnce()
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('=== COST BREAKDOWN ==='))
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Total Run Cost: $0.77'))
    writeSpy.mockRestore()
  })

  it('outputs "No build data found" when state file does not exist', async () => {
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException
    enoent.code = 'ENOENT'
    mockRead.mockRejectedValue(enoent)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerCostCommand(program)
    await program.parseAsync(['node', 'sf', 'cost'])

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('No build data found'))
    writeSpy.mockRestore()
  })

  it('rethrows non-ENOENT errors', async () => {
    mockRead.mockRejectedValue(new Error('permission denied'))

    const program = new Command()
    program.exitOverride()
    registerCostCommand(program)

    await expect(program.parseAsync(['node', 'sf', 'cost'])).rejects.toThrow('permission denied')
  })

  it('passes --config to loadConfig', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerCostCommand(program)
    await program.parseAsync(['node', 'sf', 'cost', '--config', './my-config.yaml'])

    expect(mockLoadConfig).toHaveBeenCalledWith('./my-config.yaml')
    vi.mocked(process.stdout.write).mockRestore()
  })

  it('uses --workspace-path when provided', async () => {
    mockRead.mockResolvedValue(makeState())
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const program = new Command()
    program.exitOverride()
    registerCostCommand(program)
    await program.parseAsync(['node', 'sf', 'cost', '--workspace-path', '/my/workspace'])

    expect(MockStateManager).toHaveBeenCalledWith(expect.stringContaining('/my/workspace'))
    vi.mocked(process.stdout.write).mockRestore()
  })
})
