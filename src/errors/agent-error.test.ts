import { describe, it, expect } from 'vitest'
import { AgentError, ErrorCategory, computeExitCode } from './agent-error.js'

describe('AgentError', () => {
  it('constructs with required fields', () => {
    const err = new AgentError('agent failed', ErrorCategory.Capability, 'story-1-2')
    expect(err.message).toBe('agent failed')
    expect(err.category).toBe(ErrorCategory.Capability)
    expect(err.storyId).toBe('story-1-2')
    expect(err.cause).toBeUndefined()
  })

  it('is an instance of Error and AgentError', () => {
    const err = new AgentError('fail', ErrorCategory.System, '1-3')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof AgentError).toBe(true)
    expect(err.name).toBe('AgentError')
  })

  it('accepts optional cause', () => {
    const cause = new Error('root cause')
    const err = new AgentError('wrapped', ErrorCategory.Transient, '1-1', cause)
    expect(err.cause).toBe(cause)
  })
})

describe('ErrorCategory', () => {
  it('has all four categories', () => {
    expect(ErrorCategory.Transient).toBe('Transient')
    expect(ErrorCategory.Capability).toBe('Capability')
    expect(ErrorCategory.Specification).toBe('Specification')
    expect(ErrorCategory.System).toBe('System')
  })
})

describe('computeExitCode', () => {
  it('returns 0 when all stories completed', () => {
    expect(computeExitCode(10, 0)).toBe(0)
  })

  it('returns 1 when some stories failed', () => {
    expect(computeExitCode(8, 2)).toBe(1)
  })

  it('returns 2 when no stories completed', () => {
    expect(computeExitCode(0, 5)).toBe(2)
  })

  it('returns 2 when no stories ran at all', () => {
    expect(computeExitCode(0, 0)).toBe(2)
  })
})
