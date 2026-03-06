import { describe, it, expect } from 'vitest'
import { evaluateEscalation } from './escalation.js'
import { ErrorCategory } from '@/errors/agent-error.js'
import type { ModelsConfig } from '@/config/types.js'

const models: ModelsConfig = {
  default: 'claude-haiku-4-5-20251001',
  escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'],
}

const noEscalationModels: ModelsConfig = {
  default: 'claude-haiku-4-5-20251001',
  escalation: [],
}

describe('evaluateEscalation', () => {
  // --- System errors ---

  it('returns halt for System error at attempt 1', () => {
    const result = evaluateEscalation(ErrorCategory.System, 0, 1, models, 3)
    expect(result).toEqual({ action: 'halt', reason: 'System error encountered' })
  })

  it('returns halt for System error even at maxAttempts (system overrides exhaustion check)', () => {
    const result = evaluateEscalation(ErrorCategory.System, 0, 3, models, 3)
    expect(result).toEqual({ action: 'halt', reason: 'System error encountered' })
  })

  // --- Specification errors ---

  it('returns flag for Specification error at attempt 1', () => {
    const result = evaluateEscalation(ErrorCategory.Specification, 0, 1, models, 3)
    expect(result).toEqual({
      action: 'flag',
      reason: 'Specification error: story requires human clarification',
    })
  })

  it('returns flag for Specification error even at high tier and attempt count (spec overrides exhaustion check)', () => {
    const result = evaluateEscalation(ErrorCategory.Specification, 2, 10, models, 3)
    expect(result).toEqual({
      action: 'flag',
      reason: 'Specification error: story requires human clarification',
    })
  })

  // --- Max attempts exhaustion ---

  it('returns flag when attemptCount equals maxAttempts for Transient error', () => {
    const result = evaluateEscalation(ErrorCategory.Transient, 0, 3, models, 3)
    expect(result).toEqual({ action: 'flag', reason: 'Max attempts (3) reached' })
  })

  it('returns flag when attemptCount equals maxAttempts for Capability error', () => {
    const result = evaluateEscalation(ErrorCategory.Capability, 0, 3, models, 3)
    expect(result).toEqual({ action: 'flag', reason: 'Max attempts (3) reached' })
  })

  it('does NOT flag when attemptCount is one below maxAttempts (Transient)', () => {
    const result = evaluateEscalation(ErrorCategory.Transient, 0, 2, models, 3)
    expect(result.action).toBe('retry')
  })

  // --- Transient: retry same tier ---

  it('returns retry with default model for Transient at tier 0', () => {
    const result = evaluateEscalation(ErrorCategory.Transient, 0, 1, models, 3)
    expect(result).toEqual({ action: 'retry', model: 'claude-haiku-4-5-20251001' })
  })

  it('returns retry with correct model for Transient at tier 1', () => {
    const result = evaluateEscalation(ErrorCategory.Transient, 1, 2, models, 5)
    expect(result).toEqual({ action: 'retry', model: 'claude-sonnet-4-6' })
  })

  // --- Capability: escalate to next tier ---

  it('escalates Capability error from tier 0 to tier 1 with correct model', () => {
    const result = evaluateEscalation(ErrorCategory.Capability, 0, 1, models, 3)
    expect(result).toEqual({ action: 'escalate', model: 'claude-sonnet-4-6', tier: 1 })
  })

  it('escalates Capability error from tier 1 to tier 2 with correct model', () => {
    const result = evaluateEscalation(ErrorCategory.Capability, 1, 2, models, 5)
    expect(result).toEqual({ action: 'escalate', model: 'claude-opus-4-6', tier: 2 })
  })

  it('flags Capability error when already at last tier (no more tiers to escalate)', () => {
    const result = evaluateEscalation(ErrorCategory.Capability, 2, 1, models, 5)
    expect(result).toEqual({ action: 'flag', reason: 'Capability error: all model tiers exhausted' })
  })

  it('flags Capability error immediately when no escalation tiers configured', () => {
    const result = evaluateEscalation(ErrorCategory.Capability, 0, 1, noEscalationModels, 3)
    expect(result).toEqual({ action: 'flag', reason: 'Capability error: all model tiers exhausted' })
  })
})
