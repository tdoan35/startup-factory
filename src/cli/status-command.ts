import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig } from '@/config/index.js'
import { StateManager } from '@/workspace/index.js'
import type { AppState, StoryStatus } from '@/workspace/types.js'

export function formatStatusOutput(state: AppState): string {
  const counts: Record<StoryStatus, number> = {
    pending: 0,
    'in-progress': 0,
    completed: 0,
    failed: 0,
  }

  const failedStories: Array<{ storyKey: string; phase: string; failureNote?: string }> = []

  for (const epic of Object.values(state.epics)) {
    for (const [storyKey, story] of Object.entries(epic.stories)) {
      counts[story.status]++
      if (story.status === 'failed') {
        failedStories.push({ storyKey, phase: story.phase, failureNote: story.failureNote })
      }
    }
  }

  const lines: string[] = [
    '=== BUILD STATUS ===',
    `Run Status: ${state.run.status}`,
    `Started: ${state.run.started}`,
    '',
    'Stories:',
    `  Completed: ${counts.completed}`,
    `  Failed: ${counts.failed}`,
    `  In Progress: ${counts['in-progress']}`,
    `  Pending: ${counts.pending}`,
  ]

  if (failedStories.length > 0) {
    lines.push('', 'Failed Stories:')
    for (const { storyKey, phase, failureNote } of failedStories) {
      const reason = failureNote ? `: ${failureNote}` : ''
      lines.push(`  - ${storyKey} (${phase})${reason}`)
    }
  }

  return lines.join('\n') + '\n'
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current build status')
    .option('--workspace-path <path>', 'Workspace directory path')
    .option('--config <path>', 'Path to config file')
    .action(async (options) => {
      const config = await loadConfig(options.config)
      const workspacePath = resolve(options.workspacePath ?? config.workspacePath)
      const stateManager = new StateManager(workspacePath)

      let state: AppState
      try {
        state = await stateManager.read()
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          process.stdout.write("No build data found. Run 'startup-factory build' to start a build.\n")
          return
        }
        throw err
      }

      process.stdout.write(formatStatusOutput(state))
    })
}
