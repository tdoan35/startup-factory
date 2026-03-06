import { ErrorCategory } from '@/errors/index.js'
import type { ModelsConfig } from '@/config/types.js'

export type EscalationDecision =
  | { action: 'retry'; model: string }
  | { action: 'escalate'; model: string; tier: number }
  | { action: 'flag'; reason: string }
  | { action: 'halt'; reason: string }

export function evaluateEscalation(
  errorCategory: ErrorCategory,
  currentTier: number,
  attemptCount: number,
  models: ModelsConfig,
  maxAttempts: number,
): EscalationDecision {
  if (errorCategory === ErrorCategory.System) {
    return { action: 'halt', reason: 'System error encountered' }
  }

  if (errorCategory === ErrorCategory.Specification) {
    return { action: 'flag', reason: 'Specification error: story requires human clarification' }
  }

  if (attemptCount >= maxAttempts) {
    return { action: 'flag', reason: `Max attempts (${maxAttempts}) reached` }
  }

  const allTiers = [models.default, ...models.escalation]

  if (errorCategory === ErrorCategory.Transient) {
    return { action: 'retry', model: allTiers[currentTier] }
  }

  // Capability: try to escalate to next tier
  const nextTier = currentTier + 1
  if (nextTier < allTiers.length) {
    return { action: 'escalate', model: allTiers[nextTier], tier: nextTier }
  }

  return { action: 'flag', reason: 'Capability error: all model tiers exhausted' }
}
