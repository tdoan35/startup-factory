import type { AgentRunner } from '@/agents/agent-runner.js'
import type { StateManager } from '@/workspace/index.js'
import type { AppConfig } from '@/config/index.js'
import { CostTracker } from '@/cost/index.js'
import { runStoryPipeline } from './pipeline.js'

export interface DispatcherOptions {
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  projectRoot: string
  appConfig: AppConfig
  claudeMdContent?: string
  log: (msg: string) => void
  logError: (msg: string) => void
}

export interface DispatcherResult {
  completedCount: number
  failedCount: number
}

export async function runDispatcher(opts: DispatcherOptions): Promise<DispatcherResult> {
  const { runner, stateManager, workspacePath, appConfig, log, logError, projectRoot } = opts
  const costTracker = new CostTracker()
  let completedCount = 0
  let failedCount = 0

  while (true) {
    const pending = await stateManager.getStoriesByStatus('pending')
    if (pending.length === 0) break

    const { epicKey, storyKey } = pending[0]
    log(`Starting story ${epicKey}/${storyKey}`)
    let outcome: 'completed' | 'failed'
    try {
      outcome = await runStoryPipeline({
        epicKey,
        storyKey,
        runner,
        stateManager,
        workspacePath,
        projectRoot,
        appConfig,
        claudeMdContent: opts.claudeMdContent,
        costTracker,
        log,
        logError,
      })
    } catch (err) {
      // M3: log system errors before propagating so the error context isn't lost
      logError(
        `System error for story ${epicKey}/${storyKey}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }

    if (outcome === 'completed') {
      completedCount++
    } else {
      failedCount++
    }
  }

  await costTracker.updateRunCostInState(stateManager)
  return { completedCount, failedCount }
}
