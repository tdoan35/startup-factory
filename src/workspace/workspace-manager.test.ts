import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mkdtemp, rm, access, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { WorkspaceManager } from './workspace-manager.js'

describe('WorkspaceManager', () => {
  let tempDir = ''

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('initializes workspace subdirectories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    await expect(access(manager.artifactsPath)).resolves.toBeUndefined()
    await expect(access(manager.storiesPath)).resolves.toBeUndefined()
  })

  it('is idempotent — calling initialize() twice does not throw', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    await expect(manager.initialize()).resolves.toBeUndefined()
  })

  it('creates story directory with failures/ subdirectory', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    const storyDir = await manager.ensureStoryDirectory('1-1')
    await expect(access(storyDir)).resolves.toBeUndefined()
    await expect(access(join(storyDir, 'failures'))).resolves.toBeUndefined()
  })

  it('ensureStoryDirectory returns the correct path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const wsPath = join(tempDir, '.startup-factory')
    const manager = new WorkspaceManager(wsPath)
    await manager.initialize()
    const storyDir = await manager.ensureStoryDirectory('2-3')
    expect(storyDir).toBe(join(wsPath, 'stories', '2-3'))
  })

  it('ensureStoryDirectory is idempotent — calling twice does not throw', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    await manager.ensureStoryDirectory('1-1')
    await expect(manager.ensureStoryDirectory('1-1')).resolves.toBeDefined()
  })

  it('ensureStoryDirectory rejects invalid storyKey formats', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    await expect(manager.ensureStoryDirectory('')).rejects.toThrow('Invalid storyKey')
    await expect(manager.ensureStoryDirectory('../escape')).rejects.toThrow('Invalid storyKey')
    await expect(manager.ensureStoryDirectory('1-1')).resolves.toBeDefined()
  })
})

describe('WorkspaceManager — validateArtifacts', () => {
  let tempDir: string
  let manager: WorkspaceManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'validate-test-'))
    manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
  })

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('returns valid:true when all required docs are present', async () => {
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')
    await writeFile(join(artifactsDir, 'architecture.md'), '')
    await writeFile(join(artifactsDir, 'epics.md'), '')

    const result = await manager.validateArtifacts(artifactsDir)
    expect(result.valid).toBe(true)
    expect(result.missingRequired).toEqual([])
    expect(result.requiredFound).toHaveLength(3)
  })

  it('returns valid:false and lists missing required docs', async () => {
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')
    // architecture and epics missing

    const result = await manager.validateArtifacts(artifactsDir)
    expect(result.valid).toBe(false)
    expect(result.missingRequired).toContain('Architecture')
    expect(result.missingRequired).toContain('Epics/Stories')
  })

  it('reports optional docs found without requiring them', async () => {
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')
    await writeFile(join(artifactsDir, 'architecture.md'), '')
    await writeFile(join(artifactsDir, 'epics.md'), '')
    await writeFile(join(artifactsDir, 'ux-design.md'), '')

    const result = await manager.validateArtifacts(artifactsDir)
    expect(result.valid).toBe(true)
    expect(result.optionalFound).toHaveLength(1)
  })

  it('returns empty optionalFound when no optional docs present', async () => {
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')
    await writeFile(join(artifactsDir, 'architecture.md'), '')
    await writeFile(join(artifactsDir, 'epics.md'), '')

    const result = await manager.validateArtifacts(artifactsDir)
    expect(result.optionalFound).toEqual([])
  })

  it('returns valid:false with all missing when artifacts path does not exist', async () => {
    const result = await manager.validateArtifacts(join(tempDir, 'nonexistent'))
    expect(result.valid).toBe(false)
    expect(result.missingRequired).toEqual(['PRD', 'Architecture', 'Epics/Stories'])
    expect(result.requiredFound).toEqual([])
    expect(result.optionalFound).toEqual([])
  })

  it('returns valid:false with all missing when artifacts directory is empty', async () => {
    const emptyDir = join(tempDir, 'empty-artifacts')
    await mkdir(emptyDir)
    const result = await manager.validateArtifacts(emptyDir)
    expect(result.valid).toBe(false)
    expect(result.missingRequired).toEqual(['PRD', 'Architecture', 'Epics/Stories'])
  })

  it('captures all matching files when multiple files match one pattern', async () => {
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')
    await writeFile(join(artifactsDir, 'architecture.md'), '')
    await writeFile(join(artifactsDir, 'epic-1.md'), '')
    await writeFile(join(artifactsDir, 'epic-2.md'), '')

    const result = await manager.validateArtifacts(artifactsDir)
    expect(result.valid).toBe(true)
    expect(result.requiredFound.filter(f => f.includes('epic'))).toHaveLength(2)
  })
})

describe('WorkspaceManager — resolveArtifactsPath', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('returns same path when directory contains .md files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resolve-test-'))
    const artifactsDir = join(tempDir, 'artifacts')
    await mkdir(artifactsDir)
    await writeFile(join(artifactsDir, 'prd.md'), '')

    const result = await WorkspaceManager.resolveArtifactsPath(artifactsDir)
    expect(result).toBe(artifactsDir)
  })

  it('returns BMAD nested path when input has no .md files but BMAD subdir does', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resolve-test-'))
    const projectDir = join(tempDir, 'my-project')
    const bmadDir = join(projectDir, '_bmad-output', 'planning-artifacts')
    await mkdir(bmadDir, { recursive: true })
    await writeFile(join(bmadDir, 'prd.md'), '')

    const result = await WorkspaceManager.resolveArtifactsPath(projectDir)
    expect(result).toBe(bmadDir)
  })

  it('returns same path when no .md files and no BMAD subdir', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resolve-test-'))
    const emptyDir = join(tempDir, 'empty')
    await mkdir(emptyDir)

    const result = await WorkspaceManager.resolveArtifactsPath(emptyDir)
    expect(result).toBe(emptyDir)
  })

  it('returns same path when directory does not exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resolve-test-'))
    const nonexistent = join(tempDir, 'nonexistent')

    const result = await WorkspaceManager.resolveArtifactsPath(nonexistent)
    expect(result).toBe(nonexistent)
  })
})

describe('WorkspaceManager — ingestArtifacts', () => {
  let tempDir: string
  let manager: WorkspaceManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ingest-test-'))
    manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
  })

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('copies all files from source dir to workspace artifacts dir', async () => {
    const srcDir = join(tempDir, 'source-artifacts')
    await mkdir(srcDir)
    await writeFile(join(srcDir, 'prd.md'), 'prd content')
    await writeFile(join(srcDir, 'architecture.md'), 'arch content')

    await manager.ingestArtifacts(srcDir)

    const prdContent = await readFile(join(manager.artifactsPath, 'prd.md'), 'utf-8')
    const archContent = await readFile(join(manager.artifactsPath, 'architecture.md'), 'utf-8')
    expect(prdContent).toBe('prd content')
    expect(archContent).toBe('arch content')
  })

  it('does not crash when source directory is empty', async () => {
    const emptyDir = join(tempDir, 'empty-source')
    await mkdir(emptyDir)
    await expect(manager.ingestArtifacts(emptyDir)).resolves.toBeUndefined()
  })

  it('copies only files, skipping subdirectories', async () => {
    const srcDir = join(tempDir, 'mixed-source')
    await mkdir(srcDir)
    await mkdir(join(srcDir, 'subdir'))
    await writeFile(join(srcDir, 'prd.md'), 'prd content')

    await manager.ingestArtifacts(srcDir)

    const prdContent = await readFile(join(manager.artifactsPath, 'prd.md'), 'utf-8')
    expect(prdContent).toBe('prd content')
    await expect(access(join(manager.artifactsPath, 'subdir'))).rejects.toThrow()
  })
})
