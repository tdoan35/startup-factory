import { stringify } from 'yaml'
import type { AppState } from '@/workspace/types.js'

export type OutputFormat = 'text' | 'json' | 'yaml'

export interface FailedStoryInfo {
  key: string
  phase: string
  reason: string
}

export interface CompletionSummary {
  runStatus: string
  storiesCompleted: number
  storiesFailed: number
  storiesPending: number
  totalCost: number
  failedStories: FailedStoryInfo[]
  startedAt: string
  completedAt: string
}

export function buildCompletionSummary(state: AppState): CompletionSummary {
  let completed = 0, failed = 0, pending = 0
  const failedStories: FailedStoryInfo[] = []

  for (const epic of Object.values(state.epics)) {
    for (const [storyKey, story] of Object.entries(epic.stories)) {
      if (story.status === 'completed') completed++
      else if (story.status === 'failed') {
        failed++
        failedStories.push({
          key: storyKey,
          phase: story.phase,
          reason: story.failureNote ?? 'Unknown failure',
        })
      } else pending++
    }
  }

  return {
    runStatus: state.run.status,
    storiesCompleted: completed,
    storiesFailed: failed,
    storiesPending: pending,
    totalCost: state.run.totalCost,
    failedStories,
    startedAt: state.run.started,
    completedAt: new Date().toISOString(),
  }
}

export function formatSummaryText(summary: CompletionSummary): string {
  const lines: string[] = [
    '=== BUILD COMPLETE ===',
    `Run Status: ${summary.runStatus}`,
    `Started: ${summary.startedAt}`,
    `Completed: ${summary.completedAt}`,
    '',
    'Stories:',
    `  Completed: ${summary.storiesCompleted}`,
    `  Failed: ${summary.storiesFailed}`,
    `  Pending: ${summary.storiesPending}`,
  ]

  if (summary.failedStories.length > 0) {
    lines.push('', 'Failed Stories:')
    for (const { key, phase, reason } of summary.failedStories) {
      lines.push(`  - ${key} (${phase}): ${reason}`)
    }
  }

  lines.push('', `Total Cost: $${summary.totalCost.toFixed(2)}`)

  return lines.join('\n') + '\n'
}

export function formatSummaryJson(summary: CompletionSummary): string {
  return JSON.stringify(summary, null, 2) + '\n'
}

export function formatSummaryYaml(summary: CompletionSummary): string {
  return stringify(summary)
}

export function formatSummary(summary: CompletionSummary, format: OutputFormat): string {
  switch (format) {
    case 'json': return formatSummaryJson(summary)
    case 'yaml': return formatSummaryYaml(summary)
    default: return formatSummaryText(summary)
  }
}
