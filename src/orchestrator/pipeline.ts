import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentRunner } from '@/agents/agent-runner.js'
import type { CostTracker } from '@/cost/index.js'
import type { StateManager } from '@/workspace/index.js'
import type { StoryPhase } from '@/workspace/types.js'
import { writeFailureNote, readFailureNotes } from '@/workspace/index.js'
import { storyCreatorConfig } from '@/agents/story-creator/config.js'
import { developerConfig } from '@/agents/developer/config.js'
import { codeReviewerConfig } from '@/agents/code-reviewer/config.js'
import { qaConfig } from '@/agents/qa/config.js'
import type { AgentRoleConfig } from '@/agents/types.js'
import { evaluateEscalation } from './escalation.js'
import { AgentError, ErrorCategory } from '@/errors/index.js'
import type { AppConfig } from '@/config/index.js'
import { updateSprintStatus } from '@/workspace/index.js'

export interface PipelineOptions {
  epicKey: string
  storyKey: string
  runner: AgentRunner
  stateManager: StateManager
  workspacePath: string
  projectRoot: string
  storiesPath: string
  implementationPath: string
  appConfig: AppConfig
  claudeMdContent?: string
  startPhase?: PipelinePhase
  costTracker: CostTracker
  log: (msg: string) => void
  logError: (msg: string) => void
}

export type PipelinePhase = 'storyCreation' | 'development' | 'codeReview' | 'qa'

const PHASES: Array<{ phase: PipelinePhase; config: AgentRoleConfig }> = [
  { phase: 'storyCreation', config: storyCreatorConfig },
  { phase: 'development', config: developerConfig },
  { phase: 'codeReview', config: codeReviewerConfig },
  { phase: 'qa', config: qaConfig },
]

// When code review requests changes, restart from development so the developer can fix the issues
const DEVELOPMENT_PHASE_INDEX = PHASES.findIndex(p => p.phase === 'development')

function buildPhasePrompt(phase: PipelinePhase, epicKey: string, storyKey: string): string {
  const actions: Record<PipelinePhase, string> = {
    storyCreation: 'create the story specification',
    development: 'implement the story',
    codeReview: 'review the implementation',
    qa: 'run tests and validate the implementation',
  }
  return `Process story ${storyKey} in epic ${epicKey}: ${actions[phase]}.`
}

export async function runStoryPipeline(opts: PipelineOptions): Promise<'completed' | 'failed'> {
  const { epicKey, storyKey, runner, stateManager, workspacePath, appConfig, costTracker, log, logError, projectRoot, storiesPath, implementationPath } = opts

  await mkdir(join(storiesPath, storyKey), { recursive: true })
  await stateManager.updateStory(epicKey, storyKey, { status: 'in-progress', attempts: 1 })

  let storyAttempts = 0
  let failureCount = 0
  let currentTier = 0
  const allTiers = [appConfig.models.default, ...appConfig.models.escalation]

  const startIndex = opts.startPhase
    ? PHASES.findIndex(p => p.phase === opts.startPhase)
    : 0
  let phaseIndex = startIndex >= 0 ? startIndex : 0
  // When CHANGES REQUESTED in code review, development re-runs and needs the review failure notes.
  // Also true when retrying from a specific phase — load existing notes on first attempt so the
  // retried agent has full failure context from the previous run.
  let forceLoadNotes = opts.startPhase !== undefined

  while (phaseIndex < PHASES.length) {
    const { phase, config } = PHASES[phaseIndex]
    await stateManager.updateStory(epicKey, storyKey, { phase: phase as StoryPhase })

    let phaseSuccess = false
    let phaseAttempts = 0
    // Capture and reset the flag so it applies only to this phase's first attempt
    const loadInitialNotes = forceLoadNotes
    forceLoadNotes = false

    while (!phaseSuccess) {
      storyAttempts++
      phaseAttempts++
      // Per-agent override only applies at initial tier; once escalated, use the escalation ladder
      const agentModelOverride = currentTier === 0 ? appConfig.agents?.[phase]?.model : undefined
      const currentModel = agentModelOverride ?? allTiers[currentTier]

      const isRetry = phaseAttempts > 1
      const envNote = appConfig.agents?.[phase]?.env ? ', custom env' : ''
      const modelNote = agentModelOverride ? ' (override)' : ''
      log(
        `${isRetry ? 'Retrying' : 'Dispatching'} ${phase} agent for story ${epicKey}/${storyKey}` +
        ` [${currentModel}${modelNote}${envNote}]` +
        `${isRetry ? ` (failure ${failureCount}/${appConfig.retry.maxAttempts}, tier ${currentTier})` : ''}`,
      )

      // H1: use phaseAttempts so storyCreation failure notes don't appear in development/codeReview/qa prompts
      // loadInitialNotes: true when restarting development after CHANGES REQUESTED (needs review notes)
      const failureNotes = phaseAttempts > 1 || loadInitialNotes
        ? await readFailureNotes(workspacePath, storyKey)
        : []
      const rawPrompt = await readFile(config.promptPath, 'utf-8')
      const basePrompt = rawPrompt
        .replaceAll('{{workspacePath}}', workspacePath)
        .replaceAll('{{storiesPath}}', storiesPath)
        .replaceAll('{epic}-{story}', storyKey)
      const claudePrefix = opts.claudeMdContent
        ? `## Project Context (CLAUDE.md)\n\n${opts.claudeMdContent}\n\n`
        : ''
      const systemPrompt = claudePrefix + (
        failureNotes.length > 0
          ? `${basePrompt}\n\n## Previous Failure Context\n\n${failureNotes.join('\n\n---\n\n')}`
          : basePrompt
      )

      const phaseLog = (msg: string) => log(msg.replace(/  Agent/g, `  ${phase} agent`))
      const result = await runner.run({
        model: currentModel,
        systemPrompt,
        allowedTools: config.allowedTools,
        workspacePath,
        projectRoot,
        prompt: buildPhasePrompt(phase, epicKey, storyKey),
        env: appConfig.agents?.[phase]?.env,
        log: phaseLog,
      })

      costTracker.record(storyKey, result.cost)

      if (!result.success) {
        const failureNotePath = await writeFailureNote(workspacePath, storyKey, storyAttempts, {
          errorCategory: result.errorCategory,
          errorMessage: result.output,
          modelTier: currentModel,
          phase,
          agentOutput: result.output,
        })

        // M4: single combined state update — eliminates the inconsistency window between cost/attempts and failureNote/escalationTier
        await stateManager.updateStory(epicKey, storyKey, {
          cost: costTracker.getStoryCost(storyKey),
          attempts: storyAttempts,
          failureNote: failureNotePath,
          escalationTier: currentTier,
        })

        failureCount++
        logError(
          `Phase ${phase} failed for story ${epicKey}/${storyKey} (failure ${failureCount}/${appConfig.retry.maxAttempts}): ${result.errorCategory}`,
        )

        const decision = evaluateEscalation(
          result.errorCategory,
          currentTier,
          failureCount,
          appConfig.models,
          appConfig.retry.maxAttempts,
        )

        if (decision.action === 'halt') {
          throw new AgentError(
            `System error in phase ${phase} for ${storyKey}: ${result.output}`,
            ErrorCategory.System,
            storyKey,
          )
        }

        if (decision.action === 'flag') {
          logError(`Story ${epicKey}/${storyKey} flagged for human attention: ${decision.reason}`)
          await stateManager.updateStory(epicKey, storyKey, {
            status: 'failed',
            phase: phase as StoryPhase,
          })
          try {
            await updateSprintStatus(implementationPath, storyKey, 'in-progress')
          } catch { /* best-effort */ }
          return 'failed'
        }

        if (decision.action === 'escalate') {
          currentTier = decision.tier
          log(
            `Escalating story ${epicKey}/${storyKey} to model tier ${currentTier} (${decision.model})`,
          )
        }
        // action === 'retry': currentTier unchanged, loop continues
        continue
      }

      // Phase succeeded — check code review result before marking phase done
      if (phase === 'codeReview') {
        const reviewPath = join(storiesPath, storyKey, 'review.md')
        const reviewContent = await readFile(reviewPath, 'utf-8').catch(() => result.output)
        if (reviewContent.includes('CHANGES REQUESTED')) {
          // M1: do not increment storyAttempts again — already incremented at top of loop
          const failureNotePath = await writeFailureNote(workspacePath, storyKey, storyAttempts, {
            errorCategory: ErrorCategory.Capability,
            errorMessage: 'Code review requested changes',
            modelTier: currentModel,
            phase: 'codeReview',
            agentOutput: reviewContent,
          })
          // M4: single combined state update for CHANGES REQUESTED path
          await stateManager.updateStory(epicKey, storyKey, {
            cost: costTracker.getStoryCost(storyKey),
            attempts: storyAttempts,
            failureNote: failureNotePath,
            escalationTier: currentTier,
          })
          failureCount++
          logError(`Code review requested changes for story ${epicKey}/${storyKey}`)

          const decision = evaluateEscalation(
            ErrorCategory.Capability,
            currentTier,
            failureCount,
            appConfig.models,
            appConfig.retry.maxAttempts,
          )

          if (decision.action === 'halt') {
            throw new AgentError(`System error in codeReview for ${storyKey}`, ErrorCategory.System, storyKey)
          }

          if (decision.action === 'flag') {
            logError(`Story ${epicKey}/${storyKey} flagged for human attention: ${decision.reason}`)
            await stateManager.updateStory(epicKey, storyKey, { status: 'failed', phase: 'codeReview' })
            try {
              await updateSprintStatus(implementationPath, storyKey, 'in-progress')
            } catch { /* best-effort */ }
            return 'failed'
          }

          if (decision.action === 'escalate') {
            currentTier = decision.tier
            log(
              `Escalating story ${epicKey}/${storyKey} to model tier ${currentTier} (${decision.model})`,
            )
          }
          // M1: restart from development so developer can fix the reviewed issues before re-reviewing
          forceLoadNotes = true
          break // exit inner while; outer while will restart from development phase
        }
      }

      // True success path — single state update
      await stateManager.updateStory(epicKey, storyKey, { cost: costTracker.getStoryCost(storyKey), attempts: storyAttempts })
      log(`Phase ${phase} completed for story ${epicKey}/${storyKey}`)
      phaseSuccess = true
    }

    if (!phaseSuccess) {
      // CHANGES REQUESTED: loop back to development so the developer fixes the issues first
      phaseIndex = DEVELOPMENT_PHASE_INDEX
    } else {
      phaseIndex++
    }
  }

  await stateManager.updateStory(epicKey, storyKey, { status: 'completed', phase: 'completed' })
  try {
    await updateSprintStatus(implementationPath, storyKey, 'done')
  } catch {
    log(`Warning: could not update sprint-status.yaml for ${storyKey}`)
  }
  log(`Story ${epicKey}/${storyKey} completed successfully`)
  return 'completed'
}
