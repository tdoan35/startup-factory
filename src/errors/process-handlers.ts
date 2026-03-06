export function handleUncaughtException(err: Error): never {
  console.error('Fatal error:', err.message)
  process.exit(2)
}

export function handleUnhandledRejection(reason: unknown): never {
  const msg = reason instanceof Error ? reason.message : String(reason)
  console.error('Unhandled error:', msg)
  process.exit(2)
}
