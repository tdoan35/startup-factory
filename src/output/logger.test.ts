import { vi, describe, it, expect, beforeEach } from 'vitest'
import { log, logError } from './logger.js'

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('log() writes bracket-prefixed message to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    log('hello world')
    expect(spy).toHaveBeenCalledOnce()
    const written = spy.mock.calls[0][0] as string
    expect(written).toMatch(/^\[\d{2}:\d{2}:\d{2}\] hello world\n$/)
  })

  it('logError() writes ERROR: message to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    logError('something failed')
    expect(spy).toHaveBeenCalledOnce()
    const written = spy.mock.calls[0][0] as string
    expect(written).toMatch(/^\[\d{2}:\d{2}:\d{2}\] ERROR: something failed\n$/)
  })

  it('log() does NOT call stderr', () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    log('test')
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('logError() does NOT call stdout', () => {
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    logError('test')
    expect(outSpy).not.toHaveBeenCalled()
  })
})
