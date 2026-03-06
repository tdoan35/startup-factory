import { Command } from '@commander-js/extra-typings'
import { registerBuildCommand, registerRetryCommand, registerStatusCommand, registerCostCommand } from '@/cli'
import { handleUncaughtException, handleUnhandledRejection } from '@/errors'

process.on('uncaughtException', handleUncaughtException)
process.on('unhandledRejection', handleUnhandledRejection)

const program = new Command()
program
  .name('startup-factory')
  .version('0.1.0')
  .description('Autonomous MVP builder powered by AI agents')

registerBuildCommand(program)
registerRetryCommand(program)
registerStatusCommand(program)
registerCostCommand(program)

program.parse()
