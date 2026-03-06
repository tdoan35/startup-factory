import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface FailureNoteData {
  errorCategory: string
  errorMessage: string
  modelTier: string
  phase: string
  agentOutput: string
}

function formatFailureNote(attemptNumber: number, data: FailureNoteData): string {
  return [
    `# Failure Note: Attempt ${attemptNumber}`,
    '',
    '## Error Category',
    data.errorCategory,
    '',
    '## Error Message',
    data.errorMessage,
    '',
    '## Model Tier Used',
    data.modelTier,
    '',
    '## Phase That Failed',
    data.phase,
    '',
    '## Agent Output Before Failure',
    data.agentOutput,
    '',
  ].join('\n')
}

function validateStoryKey(storyKey: string): void {
  if (!/^[\w][\w-]*$/.test(storyKey)) {
    throw new Error(`Invalid storyKey "${storyKey}": must contain only alphanumeric characters, underscores, and hyphens`)
  }
}

export async function writeFailureNote(
  workspacePath: string,
  storyKey: string,
  attemptNumber: number,
  data: FailureNoteData,
): Promise<string> {
  validateStoryKey(storyKey)
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new RangeError(`attemptNumber must be a positive integer, got ${attemptNumber}`)
  }
  const failuresDir = join(workspacePath, 'stories', storyKey, 'failures')
  await mkdir(failuresDir, { recursive: true })
  // Compute absolute attempt number to avoid EEXIST when retrying a story that has
  // existing failure notes from a previous run (the storyAttempts counter resets on retry)
  const existingFiles = await readdir(failuresDir)
  const maxExisting = existingFiles
    .filter(f => /^attempt-\d+\.md$/.test(f))
    .reduce((max, f) => Math.max(max, parseInt(f.match(/\d+/)![0], 10)), 0)
  const absoluteAttempt = Math.max(attemptNumber, maxExisting + 1)
  const filePath = join(failuresDir, `attempt-${absoluteAttempt}.md`)
  await writeFile(filePath, formatFailureNote(absoluteAttempt, data), { encoding: 'utf-8', flag: 'wx' })
  return filePath
}

export async function readFailureNotes(
  workspacePath: string,
  storyKey: string,
): Promise<string[]> {
  const failuresDir = join(workspacePath, 'stories', storyKey, 'failures')
  let files: string[]
  try {
    files = await readdir(failuresDir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const attemptFiles = files
    .filter(f => /^attempt-\d+\.md$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10)
      const numB = parseInt(b.match(/\d+/)![0], 10)
      return numA - numB
    })
  return Promise.all(attemptFiles.map(f => readFile(join(failuresDir, f), 'utf-8')))
}
