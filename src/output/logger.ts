function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

export function log(message: string): void {
  process.stdout.write(`[${timestamp()}] ${message}\n`)
}

export function logError(message: string): void {
  process.stderr.write(`[${timestamp()}] ERROR: ${message}\n`)
}
