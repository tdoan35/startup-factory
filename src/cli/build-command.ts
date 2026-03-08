import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Command } from '@commander-js/extra-typings'
import { loadConfig, mergeCliFlags } from '@/config/index.js'
import { WorkspaceManager, StateManager, parseEpicsFromArtifacts, parseEpicRange, filterEpicsByRange, readSprintStatus } from '@/workspace/index.js'
import type { RunStatus } from '@/workspace/index.js'
import { runDispatcher } from '@/orchestrator/dispatcher.js'
import { ClaudeAgentRunner } from '@/agents/index.js'
import { computeExitCode } from '@/errors/agent-error.js'
import { log, logError } from '@/output/logger.js'
import { buildCompletionSummary, formatSummary } from '@/output/summary.js'
import type { OutputFormat } from '@/output/summary.js'

export function registerBuildCommand(program: Command): void {
  program
    .command('build <artifact-path>')
    .description('Run the full build pipeline')
    .option('--max-retries <n>', 'Maximum retry attempts', (s) => parseInt(s, 10))
    .option('--model <model>', 'Default model to use')
    .option('--artifacts-path <path>', 'Artifacts directory path')
    .option('--workspace-path <path>', 'Workspace directory path')
    .option('--project-root <path>', 'Project root directory (where source code lives)')
    .option('--config <path>', 'Path to config file')
    .option('--claude-md <path>', 'Path to CLAUDE.md for project context')
    .option('--epics <range>', 'Epic range to build (e.g. 1, 1-3, 2-, -3)')
    .option('--output <format>', 'Output format for completion summary (text, json, yaml)')
    .action(async (artifactPath, options) => {
      const outputFormat: OutputFormat = (options.output as OutputFormat) ?? 'text'
      if (!['text', 'json', 'yaml'].includes(outputFormat)) {
        logError(`Invalid output format: ${options.output}. Use text, json, or yaml.`)
        process.exit(2)
      }

      const config = await loadConfig(options.config)
      const effective = mergeCliFlags(config, {
        maxRetries: options.maxRetries,
        model: options.model,
        artifactsPath: options.artifactsPath ?? artifactPath,
        workspacePath: options.workspacePath,
        claudeMdPath: options.claudeMd,
        projectRoot: options.projectRoot,
      })

      const projectRoot = resolve(effective.projectRoot)
      const workspacePath = resolve(effective.workspacePath)
      const artifactsPath = await WorkspaceManager.resolveArtifactsPath(resolve(effective.artifactsPath))

      const workspaceManager = new WorkspaceManager(workspacePath)
      await workspaceManager.initialize()

      const { valid, missingRequired } = await workspaceManager.validateArtifacts(artifactsPath)
      if (!valid) {
        logError(`Missing required artifacts: ${missingRequired.join(', ')}`)
        process.exit(2)
      }

      await workspaceManager.ingestArtifacts(artifactsPath)

      let epics = await parseEpicsFromArtifacts(workspaceManager.artifactsPath)

      if (options.epics) {
        const range = parseEpicRange(options.epics)
        epics = filterEpicsByRange(epics, range)
        if (epics.length === 0) {
          logError(`No epics match range "${options.epics}"`)
          process.exit(2)
        }
        log(`Building epics: ${epics.map(e => e.epicKey).join(', ')}`)
      }

      const sprintStatus = await readSprintStatus(artifactsPath)
      const completedStories = new Set(
        [...sprintStatus.entries()]
          .filter(([, status]) => status === 'done')
          .map(([key]) => key)
      )
      if (completedStories.size > 0) {
        log(`Skipping ${completedStories.size} already-completed stories from sprint-status.yaml`)
      }

      const stateManager = new StateManager(workspacePath)
      await stateManager.initialize(epics, {
        defaultModel: effective.models.default,
        maxRetries: effective.retry.maxAttempts,
      }, completedStories)

      let claudeMdContent: string | undefined
      if (effective.claudeMdPath) {
        claudeMdContent = await readFile(resolve(effective.claudeMdPath), 'utf-8')
      }

      const result = await runDispatcher({
        runner: new ClaudeAgentRunner(),
        stateManager,
        workspacePath,
        projectRoot,
        appConfig: effective,
        claudeMdContent,
        log,
        logError,
      })

      const exitCode = computeExitCode(result.completedCount, result.failedCount)
      const runStatus: RunStatus = exitCode === 0 ? 'completed' : exitCode === 1 ? 'partial' : 'failed'
      await stateManager.updateRun({ status: runStatus })

      const finalState = await stateManager.read()
      const summary = buildCompletionSummary(finalState)
      process.stdout.write(formatSummary(summary, outputFormat))

      process.exit(exitCode)
    })
}
