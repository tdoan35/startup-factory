import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig } from '@/config/index.js'
import { StateManager } from '@/workspace/index.js'
import type { AppState, StoryStatus } from '@/workspace/types.js'

export function formatNextAction(state: AppState): string {
  if (state.run.status === 'running') {
    return 'Build is currently running.\n'
  }

  if (state.run.status === 'completed') {
    return 'All stories completed. Nothing to do.\n'
  }

  const counts: Record<StoryStatus, number> = {
    pending: 0,
    'in-progress': 0,
    completed: 0,
    failed: 0,
  }

  let firstFailed: { storyKey: string; phase: string; epicKey: string } | undefined

  for (const [epicKey, epic] of Object.entries(state.epics)) {
    for (const [storyKey, story] of Object.entries(epic.stories)) {
      counts[story.status]++
      if (story.status === 'failed' && !firstFailed) {
        firstFailed = { storyKey, phase: story.phase, epicKey }
      }
    }
  }

  if (counts['in-progress'] > 0) {
    return 'Build was interrupted. Resume with:\n  startup-factory build <artifact-path>\n'
  }

  if (firstFailed) {
    const remaining = counts.failed - 1
    const lines = [
      `Next: retry the failed story:\n  startup-factory retry ${firstFailed.storyKey}`,
    ]
    if (remaining > 0) {
      lines.push(`(${remaining} more failed ${remaining === 1 ? 'story' : 'stories'} remaining)`)
    }
    return lines.join('\n') + '\n'
  }

  if (counts.pending > 0) {
    return 'Build has pending stories. Continue with:\n  startup-factory build <artifact-path>\n'
  }

  return 'All stories completed. Nothing to do.\n'
}

export function registerNextCommand(program: Command): void {
  program
    .command('next')
    .description('Suggest the next build action')
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
          process.stdout.write('No build found. Start with:\n  startup-factory build <artifact-path>\n')
          return
        }
        throw err
      }

      process.stdout.write(formatNextAction(state))
    })
}
