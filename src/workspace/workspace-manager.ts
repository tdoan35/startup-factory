import { mkdir, readdir, copyFile, access } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

const STORY_KEY_PATTERN = /^[a-zA-Z0-9]+-[a-zA-Z0-9]+$/

export interface ArtifactValidationResult {
  valid: boolean
  requiredFound: string[]
  missingRequired: string[]
  optionalFound: string[]
}

const REQUIRED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'PRD', pattern: /prd.*\.md$/i },
  { name: 'Architecture', pattern: /architecture.*\.md$/i },
  { name: 'Epics/Stories', pattern: /(epic|stories).*\.md$/i },
]

const OPTIONAL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'UX Design', pattern: /ux.*\.md$/i },
  { name: 'Research', pattern: /research.*\.md$/i },
]

export class WorkspaceManager {
  readonly workspacePath: string
  readonly artifactsPath: string
  readonly storiesPath: string

  /**
   * Resolves the actual artifacts path, auto-detecting BMAD directory structure.
   * If the input path contains .md files matching required patterns, returns it as-is.
   * Otherwise checks for `_bmad-output/planning-artifacts/` subdirectory.
   */
  static async resolveArtifactsPath(inputPath: string): Promise<string> {
    // Check if inputPath itself has .md files
    try {
      const dirents = await readdir(inputPath, { withFileTypes: true })
      const hasMd = dirents.some(d => d.isFile() && d.name.endsWith('.md'))
      if (hasMd) return inputPath
    } catch {
      // Directory doesn't exist or can't be read — fall through
    }

    // Check BMAD nested structure
    const bmadPath = join(inputPath, '_bmad-output', 'planning-artifacts')
    try {
      await access(bmadPath)
      const dirents = await readdir(bmadPath, { withFileTypes: true })
      const hasMd = dirents.some(d => d.isFile() && d.name.endsWith('.md'))
      if (hasMd) return bmadPath
    } catch {
      // BMAD path doesn't exist — fall through
    }

    return inputPath
  }

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.artifactsPath = join(workspacePath, 'artifacts')
    this.storiesPath = join(workspacePath, 'stories')
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.artifactsPath, { recursive: true }),
      mkdir(this.storiesPath, { recursive: true }),
    ])
  }

  async ensureStoryDirectory(storyKey: string): Promise<string> {
    if (!STORY_KEY_PATTERN.test(storyKey)) {
      throw new Error(`Invalid storyKey: "${storyKey}". Must match {epic}-{story} format (e.g. "1-1").`)
    }
    const storyDir = join(this.storiesPath, storyKey)
    // Verify resolved path stays within storiesPath (defense-in-depth against traversal)
    if (!resolve(storyDir).startsWith(resolve(this.storiesPath) + sep)) {
      throw new Error(`storyKey "${storyKey}" resolves outside workspace stories directory.`)
    }
    await mkdir(join(storyDir, 'failures'), { recursive: true })
    return storyDir
  }

  async validateArtifacts(artifactsPath: string): Promise<ArtifactValidationResult> {
    let mdFiles: string[]
    try {
      // withFileTypes avoids a second stat call and lets us skip subdirectories safely
      const dirents = await readdir(artifactsPath, { withFileTypes: true })
      mdFiles = dirents.filter(d => d.isFile() && d.name.endsWith('.md')).map(d => d.name)
    } catch (err: unknown) {
      // Treat a missing directory the same as an empty one — all required docs are absent.
      // Callers (e.g. the build command) can rely on this: validateArtifacts never throws for ENOENT.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          valid: false,
          requiredFound: [],
          missingRequired: REQUIRED_PATTERNS.map(p => p.name),
          optionalFound: [],
        }
      }
      throw err
    }

    const requiredFound: string[] = []
    const missingRequired: string[] = []
    for (const { name, pattern } of REQUIRED_PATTERNS) {
      const matches = mdFiles.filter(f => pattern.test(f))
      if (matches.length > 0) {
        for (const match of matches) requiredFound.push(join(artifactsPath, match))
      } else {
        missingRequired.push(name)
      }
    }

    const optionalFound: string[] = []
    for (const { name: _name, pattern } of OPTIONAL_PATTERNS) {
      const matches = mdFiles.filter(f => pattern.test(f))
      for (const match of matches) optionalFound.push(join(artifactsPath, match))
    }

    return {
      valid: missingRequired.length === 0,
      requiredFound,
      missingRequired,
      optionalFound,
    }
  }

  async ingestArtifacts(artifactsPath: string): Promise<void> {
    const dirents = await readdir(artifactsPath, { withFileTypes: true })
    // Only copy files — subdirectories in the source are intentionally skipped.
    // Agents read from this.artifactsPath which is a flat directory.
    await Promise.all(
      dirents
        .filter(d => d.isFile())
        .map(d => copyFile(join(artifactsPath, d.name), join(this.artifactsPath, d.name)))
    )
  }
}
