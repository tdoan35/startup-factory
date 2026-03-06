import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig, mergeCliFlags } from '@/config/index.js'
import { StateManager } from '@/workspace/index.js'
import type { StoryPhase } from '@/workspace/index.js'
import { runStoryPipeline } from '@/orchestrator/index.js'
import type { PipelinePhase } from '@/orchestrator/index.js'
import { ClaudeAgentRunner } from '@/agents/index.js'
import { computeExitCode } from '@/errors/agent-error.js'
import { log, logError } from '@/output/logger.js'

export function registerRetryCommand(program: Command): void {
  program
    .command('retry <story-id>')
    .description('Retry a failed story')
    .option('--max-retries <n>', 'Maximum retry attempts', (s) => parseInt(s, 10))
    .option('--model <model>', 'Default model to use')
    .option('--config <path>', 'Path to config file')
    .action(async (storyId, options) => {
      const config = await loadConfig(options.config)
      const effective = mergeCliFlags(config, {
        maxRetries: options.maxRetries,
        model: options.model,
      })

      const workspacePath = resolve(effective.workspacePath)
      const stateManager = new StateManager(workspacePath)

      const storyEntry = await stateManager.getStoryByKey(storyId)

      if (!storyEntry) {
        logError(`Story not found in state: ${storyId}`)
        return process.exit(2)
      }

      if (storyEntry.status === 'completed') {
        log(`Story ${storyId} is already completed. Nothing to retry.`)
        return process.exit(0)
      }

      if (storyEntry.status === 'in-progress') {
        log(`Story ${storyId} is currently in-progress. Nothing to retry.`)
        return process.exit(0)
      }

      const retryablePhases: StoryPhase[] = ['storyCreation', 'development', 'codeReview', 'qa']
      const startPhase = retryablePhases.includes(storyEntry.phase)
        ? (storyEntry.phase as PipelinePhase)
        : undefined

      await stateManager.updateStory(storyEntry.epicKey, storyId, {
        status: 'pending',
        phase: 'pending',
        attempts: 0,
      })

      log(`Retrying story ${storyId} from phase: ${startPhase ?? 'storyCreation (beginning)'}`)

      let outcome: 'completed' | 'failed'
      try {
        outcome = await runStoryPipeline({
          epicKey: storyEntry.epicKey,
          storyKey: storyId,
          runner: new ClaudeAgentRunner(),
          stateManager,
          workspacePath,
          appConfig: effective,
          startPhase,
          log,
          logError,
        })
      } catch (err) {
        logError(`System error during retry of story ${storyId}: ${String(err)}`)
        return process.exit(2)
      }

      const exitCode = computeExitCode(
        outcome === 'completed' ? 1 : 0,
        outcome === 'failed' ? 1 : 0,
      )
      process.exit(exitCode)
    })
}
