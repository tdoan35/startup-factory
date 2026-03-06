import { describe, it, expect, vi, afterEach } from 'vitest'
import { handleUncaughtException, handleUnhandledRejection } from './process-handlers.js'

describe('handleUncaughtException', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs error message and exits with code 2', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    handleUncaughtException(new Error('fatal test error'))

    expect(errorSpy).toHaveBeenCalledWith('Fatal error:', 'fatal test error')
    expect(exitSpy).toHaveBeenCalledWith(2)
  })
})

describe('handleUnhandledRejection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs error message when reason is an Error and exits with code 2', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    handleUnhandledRejection(new Error('rejected error'))

    expect(errorSpy).toHaveBeenCalledWith('Unhandled error:', 'rejected error')
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('stringifies non-Error reason and exits with code 2', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    handleUnhandledRejection('string rejection')

    expect(errorSpy).toHaveBeenCalledWith('Unhandled error:', 'string rejection')
    expect(exitSpy).toHaveBeenCalledWith(2)
  })
})
