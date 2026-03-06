export enum ErrorCategory {
  Transient = 'Transient',
  Capability = 'Capability',
  Specification = 'Specification',
  System = 'System',
}

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly storyId: string,
    public readonly cause?: Error
  ) {
    super(message, { cause })
    this.name = 'AgentError'
  }
}

export function computeExitCode(completedCount: number, failedCount: number): 0 | 1 | 2 {
  if (completedCount === 0) return 2
  if (failedCount === 0) return 0
  return 1
}
