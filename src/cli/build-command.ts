import { resolve } from 'node:path'
import { Command } from '@commander-js/extra-typings'
import { loadConfig, mergeCliFlags } from '@/config/index.js'
import { WorkspaceManager, StateManager, parseEpicsFromArtifacts } from '@/workspace/index.js'
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
    .option('--config <path>', 'Path to config file')
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
      })

      const workspacePath = resolve(effective.workspacePath)
      const artifactsPath = resolve(effective.artifactsPath)

      const workspaceManager = new WorkspaceManager(workspacePath)
      await workspaceManager.initialize()

      const { valid, missingRequired } = await workspaceManager.validateArtifacts(artifactsPath)
      if (!valid) {
        logError(`Missing required artifacts: ${missingRequired.join(', ')}`)
        process.exit(2)
      }

      await workspaceManager.ingestArtifacts(artifactsPath)

      const epics = await parseEpicsFromArtifacts(workspaceManager.artifactsPath)

      const stateManager = new StateManager(workspacePath)
      await stateManager.initialize(epics, {
        defaultModel: effective.models.default,
        maxRetries: effective.retry.maxAttempts,
      })

      const result = await runDispatcher({
        runner: new ClaudeAgentRunner(),
        stateManager,
        workspacePath,
        appConfig: effective,
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
