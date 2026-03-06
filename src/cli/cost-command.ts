import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig } from '@/config/index.js'
import { StateManager } from '@/workspace/index.js'
import type { AppState } from '@/workspace/types.js'

export function formatCostOutput(state: AppState): string {
  const storyEntries: Array<{ storyKey: string; cost: number }> = []

  for (const epic of Object.values(state.epics)) {
    for (const [storyKey, story] of Object.entries(epic.stories)) {
      storyEntries.push({ storyKey, cost: story.cost })
    }
  }

  const lines: string[] = [
    '=== COST BREAKDOWN ===',
    'Per-Story Costs:',
  ]

  for (const { storyKey, cost } of storyEntries) {
    lines.push(`  ${storyKey}: $${(cost ?? 0).toFixed(2)}`)
  }

  lines.push('', `Total Run Cost: $${(state.run.totalCost ?? 0).toFixed(2)}`)

  return lines.join('\n') + '\n'
}

export function registerCostCommand(program: Command): void {
  program
    .command('cost')
    .description('Show cost summary')
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

      process.stdout.write(formatCostOutput(state))
    })
}
