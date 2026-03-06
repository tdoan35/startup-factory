import { describe, it, expect } from 'vitest'
import { parse as yamlParse } from 'yaml'
import type { AppState } from '@/workspace/types.js'
import {
  buildCompletionSummary,
  formatSummaryText,
  formatSummaryJson,
  formatSummaryYaml,
  formatSummary,
} from './summary.js'
import type { CompletionSummary, OutputFormat } from './summary.js'

function makeState(overrides?: Partial<AppState>): AppState {
  return {
    run: {
      status: 'completed',
      started: '2026-03-06T22:00:00Z',
      config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 },
      totalCost: 4.23,
    },
    epics: {},
    ...overrides,
  }
}

function makeFullState(): AppState {
  return makeState({
    epics: {
      'epic-1': {
        status: 'completed',
        stories: {
          '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 1.0 },
          '1-2': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
        },
      },
      'epic-2': {
        status: 'in-progress',
        stories: {
          '2-1': { status: 'completed', phase: 'completed', attempts: 2, cost: 1.5 },
          '2-2': { status: 'failed', phase: 'development', attempts: 3, cost: 0.8, failureNote: 'Capability error - agent could not complete' },
          '2-3': { status: 'pending', phase: 'pending', attempts: 0, cost: 0 },
        },
      },
    },
  })
}

describe('buildCompletionSummary', () => {
  it('returns correct counts for all-completed state', () => {
    const state = makeState({
      epics: {
        'epic-1': {
          status: 'completed',
          stories: {
            '1-1': { status: 'completed', phase: 'completed', attempts: 1, cost: 1.0 },
            '1-2': { status: 'completed', phase: 'completed', attempts: 1, cost: 0.5 },
          },
        },
      },
    })

    const summary = buildCompletionSummary(state)

    expect(summary.runStatus).toBe('completed')
    expect(summary.storiesCompleted).toBe(2)
    expect(summary.storiesFailed).toBe(0)
    expect(summary.storiesPending).toBe(0)
    expect(summary.totalCost).toBe(4.23)
    expect(summary.failedStories).toEqual([])
    expect(summary.startedAt).toBe('2026-03-06T22:00:00Z')
    expect(summary.completedAt).toBeDefined()
  })

  it('returns correct counts for partial state with failures', () => {
    const state = makeFullState()
    const summary = buildCompletionSummary(state)

    expect(summary.storiesCompleted).toBe(3)
    expect(summary.storiesFailed).toBe(1)
    expect(summary.storiesPending).toBe(1)
    expect(summary.failedStories).toEqual([
      { key: '2-2', phase: 'development', reason: 'Capability error - agent could not complete' },
    ])
  })

  it('returns correct counts for total failure state', () => {
    const state = makeState({
      run: { status: 'failed', started: '2026-03-06T22:00:00Z', config: { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 }, totalCost: 0.5 },
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'failed', phase: 'development', attempts: 3, cost: 0.5, failureNote: 'System error' },
          },
        },
      },
    })

    const summary = buildCompletionSummary(state)

    expect(summary.runStatus).toBe('failed')
    expect(summary.storiesCompleted).toBe(0)
    expect(summary.storiesFailed).toBe(1)
    expect(summary.storiesPending).toBe(0)
    expect(summary.failedStories).toEqual([
      { key: '1-1', phase: 'development', reason: 'System error' },
    ])
  })

  it('uses "Unknown failure" when failureNote is undefined', () => {
    const state = makeState({
      epics: {
        'epic-1': {
          status: 'in-progress',
          stories: {
            '1-1': { status: 'failed', phase: 'qa', attempts: 1, cost: 0.1 },
          },
        },
      },
    })

    const summary = buildCompletionSummary(state)
    expect(summary.failedStories[0].reason).toBe('Unknown failure')
  })

  it('handles empty epics', () => {
    const state = makeState({ epics: {} })
    const summary = buildCompletionSummary(state)

    expect(summary.storiesCompleted).toBe(0)
    expect(summary.storiesFailed).toBe(0)
    expect(summary.storiesPending).toBe(0)
    expect(summary.failedStories).toEqual([])
  })
})

describe('formatSummaryText', () => {
  it('produces human-readable output with section headers', () => {
    const summary: CompletionSummary = {
      runStatus: 'completed',
      storiesCompleted: 10,
      storiesFailed: 0,
      storiesPending: 0,
      totalCost: 4.23,
      failedStories: [],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const output = formatSummaryText(summary)

    expect(output).toContain('=== BUILD COMPLETE ===')
    expect(output).toContain('Run Status: completed')
    expect(output).toContain('Started: 2026-03-06T22:00:00Z')
    expect(output).toContain('Completed: 2026-03-06T23:00:00Z')
    expect(output).toContain('Completed: 10')
    expect(output).toContain('Failed: 0')
    expect(output).toContain('Pending: 0')
    expect(output).toContain('Total Cost: $4.23')
  })

  it('includes failed stories section when failures exist', () => {
    const summary: CompletionSummary = {
      runStatus: 'partial',
      storiesCompleted: 8,
      storiesFailed: 2,
      storiesPending: 0,
      totalCost: 4.23,
      failedStories: [
        { key: '2-1', phase: 'development', reason: 'Capability error - agent could not complete implementation' },
        { key: '3-2', phase: 'qa', reason: 'Specification error - ambiguous acceptance criteria' },
      ],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const output = formatSummaryText(summary)

    expect(output).toContain('Failed Stories:')
    expect(output).toContain('2-1 (development): Capability error - agent could not complete implementation')
    expect(output).toContain('3-2 (qa): Specification error - ambiguous acceptance criteria')
  })

  it('does not include Failed Stories section when no failures', () => {
    const summary: CompletionSummary = {
      runStatus: 'completed',
      storiesCompleted: 5,
      storiesFailed: 0,
      storiesPending: 0,
      totalCost: 1.0,
      failedStories: [],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const output = formatSummaryText(summary)
    expect(output).not.toContain('Failed Stories:')
  })
})

describe('formatSummaryJson', () => {
  it('outputs valid JSON', () => {
    const summary: CompletionSummary = {
      runStatus: 'completed',
      storiesCompleted: 5,
      storiesFailed: 0,
      storiesPending: 0,
      totalCost: 2.5,
      failedStories: [],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const output = formatSummaryJson(summary)
    const parsed = JSON.parse(output)

    expect(parsed.runStatus).toBe('completed')
    expect(parsed.storiesCompleted).toBe(5)
    expect(parsed.storiesFailed).toBe(0)
    expect(parsed.totalCost).toBe(2.5)
    expect(parsed.failedStories).toEqual([])
  })

  it('preserves failed story details in JSON', () => {
    const summary: CompletionSummary = {
      runStatus: 'partial',
      storiesCompleted: 3,
      storiesFailed: 1,
      storiesPending: 0,
      totalCost: 1.0,
      failedStories: [{ key: '1-1', phase: 'development', reason: 'test error' }],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const parsed = JSON.parse(formatSummaryJson(summary))
    expect(parsed.failedStories).toHaveLength(1)
    expect(parsed.failedStories[0].key).toBe('1-1')
  })
})

describe('formatSummaryYaml', () => {
  it('outputs valid YAML', () => {
    const summary: CompletionSummary = {
      runStatus: 'completed',
      storiesCompleted: 5,
      storiesFailed: 0,
      storiesPending: 0,
      totalCost: 2.5,
      failedStories: [],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const output = formatSummaryYaml(summary)
    const parsed = yamlParse(output)

    expect(parsed.runStatus).toBe('completed')
    expect(parsed.storiesCompleted).toBe(5)
    expect(parsed.storiesFailed).toBe(0)
    expect(parsed.totalCost).toBe(2.5)
    expect(parsed.failedStories).toEqual([])
  })

  it('preserves failed story details in YAML', () => {
    const summary: CompletionSummary = {
      runStatus: 'partial',
      storiesCompleted: 3,
      storiesFailed: 1,
      storiesPending: 0,
      totalCost: 1.0,
      failedStories: [{ key: '1-1', phase: 'development', reason: 'test error' }],
      startedAt: '2026-03-06T22:00:00Z',
      completedAt: '2026-03-06T23:00:00Z',
    }

    const parsed = yamlParse(formatSummaryYaml(summary))
    expect(parsed.failedStories).toHaveLength(1)
    expect(parsed.failedStories[0].key).toBe('1-1')
  })
})

describe('formatSummary', () => {
  const summary: CompletionSummary = {
    runStatus: 'completed',
    storiesCompleted: 5,
    storiesFailed: 0,
    storiesPending: 0,
    totalCost: 2.5,
    failedStories: [],
    startedAt: '2026-03-06T22:00:00Z',
  }

  it('dispatches to text formatter for "text" format', () => {
    const output = formatSummary(summary, 'text')
    expect(output).toContain('=== BUILD COMPLETE ===')
  })

  it('dispatches to JSON formatter for "json" format', () => {
    const output = formatSummary(summary, 'json')
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('dispatches to YAML formatter for "yaml" format', () => {
    const output = formatSummary(summary, 'yaml')
    expect(() => yamlParse(output)).not.toThrow()
  })
})
