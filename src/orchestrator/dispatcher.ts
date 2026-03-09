import type { AgentRunner } from '@/agents/agent-runner.js'
import type { StateManager } from '@/workspace/index.js'
import type { AppConfig } from '@/config/index.js'
import { CostTracker } from '@/cost/index.js'
import { runStoryPipeline } from './pipeline.js'
import type { PipelinePhase } from './pipeline.js'

export interface DispatcherOptions {
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  projectRoot: string
  storiesPath: string
  implementationPath: string
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
  const { runner, stateManager, workspacePath, appConfig, log, logError, projectRoot, storiesPath, implementationPath } = opts
  const costTracker = new CostTracker()
  let completedCount = 0
  let failedCount = 0

  while (true) {
    const pending = await stateManager.getStoriesByStatus('pending')
    if (pending.length === 0) break

    const story = pending[0]
    const { epicKey, storyKey } = story
    const resumePhase = story.resumeFromPhase as PipelinePhase | undefined
    if (resumePhase) {
      log(`Resuming story ${epicKey}/${storyKey} from ${resumePhase} (skipping earlier phases)`)
    } else {
      log(`Starting story ${epicKey}/${storyKey}`)
    }
    let outcome: 'completed' | 'failed'
    try {
      outcome = await runStoryPipeline({
        epicKey,
        storyKey,
        runner,
        stateManager,
        workspacePath,
        projectRoot,
        storiesPath,
        implementationPath,
        appConfig,
        claudeMdContent: opts.claudeMdContent,
        costTracker,
        startPhase: resumePhase,
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
