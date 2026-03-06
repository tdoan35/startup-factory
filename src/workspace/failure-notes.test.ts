import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFailureNote, readFailureNotes } from './failure-notes.js'
import type { FailureNoteData } from './failure-notes.js'

const sampleData: FailureNoteData = {
  errorCategory: 'TestError',
  errorMessage: 'Something went wrong',
  modelTier: 'tier-1',
  phase: 'dev',
  agentOutput: 'Some output before failure',
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'failure-notes-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('writeFailureNote', () => {
  it('creates file at correct path stories/{storyKey}/failures/attempt-1.md', async () => {
    const filePath = await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    expect(filePath).toBe(join(tmpDir, 'stories', '1-2', 'failures', 'attempt-1.md'))
    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('# Failure Note: Attempt 1')
  })

  it('file content contains all 5 fields', async () => {
    const filePath = await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain(sampleData.errorCategory)
    expect(content).toContain(sampleData.errorMessage)
    expect(content).toContain(sampleData.modelTier)
    expect(content).toContain(sampleData.phase)
    expect(content).toContain(sampleData.agentOutput)
  })

  it('second write with attemptNumber=2 creates attempt-2.md without overwriting attempt-1.md', async () => {
    const path1 = await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    const path2 = await writeFailureNote(tmpDir, '1-2', 2, { ...sampleData, errorMessage: 'Second failure' })
    expect(path1).toContain('attempt-1.md')
    expect(path2).toContain('attempt-2.md')
    const content1 = await readFile(path1, 'utf-8')
    const content2 = await readFile(path2, 'utf-8')
    expect(content1).toContain('Something went wrong')
    expect(content2).toContain('Second failure')
  })

  it('increments to next available number when attemptNumber collides with existing file (retry safety)', async () => {
    const path1 = await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    const path2 = await writeFailureNote(tmpDir, '1-2', 1, { ...sampleData, errorMessage: 'Retry attempt' })
    expect(path1).toContain('attempt-1.md')
    expect(path2).toContain('attempt-2.md')
    const content1 = await readFile(path1, 'utf-8')
    const content2 = await readFile(path2, 'utf-8')
    expect(content1).toContain('Something went wrong')
    expect(content2).toContain('Retry attempt')
  })

  it('continues from max existing attempt when retrying a story with prior failure notes', async () => {
    // Simulate story that failed 3 times in a previous run
    await writeFailureNote(tmpDir, '1-2', 1, { ...sampleData, errorMessage: 'Run 1 attempt 1' })
    await writeFailureNote(tmpDir, '1-2', 2, { ...sampleData, errorMessage: 'Run 1 attempt 2' })
    await writeFailureNote(tmpDir, '1-2', 3, { ...sampleData, errorMessage: 'Run 1 attempt 3' })
    // Retry resets storyAttempts to 0 — first failure writes attemptNumber=1
    const retryPath = await writeFailureNote(tmpDir, '1-2', 1, { ...sampleData, errorMessage: 'Retry run attempt 1' })
    expect(retryPath).toContain('attempt-4.md')
    const notes = await readFailureNotes(tmpDir, '1-2')
    expect(notes).toHaveLength(4)
  })

  it('creates parent directories if they do not exist (storyKey not pre-created)', async () => {
    const filePath = await writeFailureNote(tmpDir, 'epic-1-story-99', 1, sampleData)
    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('Failure Note: Attempt 1')
  })

  it('returns the correct file path string', async () => {
    const filePath = await writeFailureNote(tmpDir, '3-4', 5, sampleData)
    expect(filePath).toBe(join(tmpDir, 'stories', '3-4', 'failures', 'attempt-5.md'))
  })

  it('throws for invalid storyKey containing path traversal characters', async () => {
    await expect(writeFailureNote(tmpDir, '../evil', 1, sampleData)).rejects.toThrow(/Invalid storyKey/)
    await expect(writeFailureNote(tmpDir, '../../etc/passwd', 1, sampleData)).rejects.toThrow(/Invalid storyKey/)
    await expect(writeFailureNote(tmpDir, 'story/nested', 1, sampleData)).rejects.toThrow(/Invalid storyKey/)
  })

  it('throws for invalid attemptNumber (zero, negative, non-integer)', async () => {
    await expect(writeFailureNote(tmpDir, '1-2', 0, sampleData)).rejects.toThrow(RangeError)
    await expect(writeFailureNote(tmpDir, '1-2', -1, sampleData)).rejects.toThrow(RangeError)
    await expect(writeFailureNote(tmpDir, '1-2', 1.5, sampleData)).rejects.toThrow(RangeError)
  })
})

describe('readFailureNotes', () => {
  it('returns [] when failures directory does not exist', async () => {
    const notes = await readFailureNotes(tmpDir, 'nonexistent-story')
    expect(notes).toEqual([])
  })

  it('returns single note content when one file exists', async () => {
    await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    const notes = await readFailureNotes(tmpDir, '1-2')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('Failure Note: Attempt 1')
    expect(notes[0]).toContain(sampleData.errorCategory)
  })

  it('returns multiple notes sorted by attempt number ascending', async () => {
    await writeFailureNote(tmpDir, '1-2', 1, { ...sampleData, errorMessage: 'First' })
    await writeFailureNote(tmpDir, '1-2', 2, { ...sampleData, errorMessage: 'Second' })
    const notes = await readFailureNotes(tmpDir, '1-2')
    expect(notes).toHaveLength(2)
    expect(notes[0]).toContain('Attempt 1')
    expect(notes[0]).toContain('First')
    expect(notes[1]).toContain('Attempt 2')
    expect(notes[1]).toContain('Second')
  })

  it('ignores files that do not match attempt-N.md pattern', async () => {
    await writeFailureNote(tmpDir, '1-2', 1, sampleData)
    const failuresDir = join(tmpDir, 'stories', '1-2', 'failures')
    await mkdir(failuresDir, { recursive: true })
    await writeFile(join(failuresDir, 'other.md'), 'ignore me')
    await writeFile(join(failuresDir, 'attempt-foo.md'), 'ignore me too')
    const notes = await readFailureNotes(tmpDir, '1-2')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('Failure Note: Attempt 1')
  })
})
