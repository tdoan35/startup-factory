import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseSprintStatus, readSprintStatus } from './sprint-status-reader.js'

describe('parseSprintStatus', () => {
  it('extracts numeric key prefixes from development_status entries', () => {
    const content = `
development_status:
  epic-1: backlog
  1-1-backend-project-initialization: done
  1-2-frontend-project-initialization: backlog
  2-1-resume-upload: in-progress
`
    const result = parseSprintStatus(content)
    expect(result.get('1-1')).toBe('done')
    expect(result.get('1-2')).toBe('backlog')
    expect(result.get('2-1')).toBe('in-progress')
    // epic-level keys don't match \d+-\d+ prefix pattern
    expect(result.has('epic-1')).toBe(false)
  })

  it('returns empty map for empty content', () => {
    const result = parseSprintStatus('')
    expect(result.size).toBe(0)
  })

  it('returns empty map when development_status is missing', () => {
    const content = `
project: test
generated: 2026-03-03
`
    const result = parseSprintStatus(content)
    expect(result.size).toBe(0)
  })

  it('ignores non-string values', () => {
    const content = `
development_status:
  1-1-story: done
  1-2-story: 42
`
    const result = parseSprintStatus(content)
    expect(result.get('1-1')).toBe('done')
    expect(result.has('1-2')).toBe(false)
  })

  it('handles retrospective entries (no numeric prefix)', () => {
    const content = `
development_status:
  epic-1-retrospective: optional
  1-1-story: done
`
    const result = parseSprintStatus(content)
    expect(result.get('1-1')).toBe('done')
    expect(result.size).toBe(1)
  })
})

describe('readSprintStatus', () => {
  let tempDir = ''

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('reads sprint-status.yaml from sibling implementation-artifacts directory', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sprint-test-'))
    const planningDir = join(tempDir, '_bmad-output', 'planning-artifacts')
    const implDir = join(tempDir, '_bmad-output', 'implementation-artifacts')
    await mkdir(planningDir, { recursive: true })
    await mkdir(implDir, { recursive: true })
    await writeFile(join(implDir, 'sprint-status.yaml'), `
development_status:
  1-1-story: done
  1-2-story: backlog
`)

    const result = await readSprintStatus(planningDir)
    expect(result.get('1-1')).toBe('done')
    expect(result.get('1-2')).toBe('backlog')
  })

  it('returns empty map when no sprint-status.yaml exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sprint-test-'))
    const result = await readSprintStatus(tempDir)
    expect(result.size).toBe(0)
  })

  it('reads from ../../_bmad-output when artifactsDir is nested two levels deep', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sprint-test-'))
    // Simulate: artifactsDir = project/subdir/artifacts, sprint-status at project/_bmad-output/...
    const projectDir = join(tempDir, 'project')
    const artifactsDir = join(projectDir, 'subdir', 'artifacts')
    const implDir = join(projectDir, '_bmad-output', 'implementation-artifacts')
    await mkdir(artifactsDir, { recursive: true })
    await mkdir(implDir, { recursive: true })
    await writeFile(join(implDir, 'sprint-status.yaml'), `
development_status:
  3-1-story: done
`)

    // artifactsDir is project/subdir/artifacts, so ../../_bmad-output/implementation-artifacts
    // resolves to project/_bmad-output/implementation-artifacts
    const result = await readSprintStatus(artifactsDir)
    expect(result.get('3-1')).toBe('done')
  })
})
