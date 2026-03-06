# Story 2.2: BMAD Artifact Validation & Ingestion

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the system to validate that my BMAD planning artifacts are complete before starting a build,
so that I get a clear error if required documents are missing rather than a confusing pipeline failure.

## Acceptance Criteria

1. **Given** a valid artifacts path containing PRD, Architecture, and Epics/Stories documents, **When** the system validates the artifacts, **Then** it identifies all required files as present and reports success.

2. **Given** an artifacts path missing one or more required documents (PRD, Architecture, or Epics/Stories), **When** the system validates the artifacts, **Then** it fails with a clear error listing which required documents are missing.

3. **Given** an artifacts path with optional documents (UX Design, Research), **When** the system validates the artifacts, **Then** it identifies and reports optional documents found without requiring them.

4. **Given** validated artifacts, **When** the system ingests them, **Then** it copies the artifacts into the `.startup-factory/artifacts/` directory for agent access.

## Tasks / Subtasks

- [x] Task 1: Export `ArtifactValidationResult` type from `src/workspace/workspace-manager.ts` (AC: #1, #2, #3)
  - [x] 1.1: Define and export interface `ArtifactValidationResult { valid: boolean; requiredFound: string[]; missingRequired: string[]; optionalFound: string[]; }`
  - [x] 1.2: Define internal constants `REQUIRED_PATTERNS` and `OPTIONAL_PATTERNS` as arrays of `{ name: string; pattern: RegExp }` — use the exact patterns from the architecture doc

- [x] Task 2: Implement `validateArtifacts` method on `WorkspaceManager` (AC: #1, #2, #3)
  - [x] 2.1: Implement `async validateArtifacts(artifactsPath: string): Promise<ArtifactValidationResult>`
  - [x] 2.2: Use `readdir` from `node:fs/promises` to list `.md` files in `artifactsPath`
  - [x] 2.3: For each `REQUIRED_PATTERNS` entry, check if any listed file matches the pattern; populate `requiredFound` with matching file paths and `missingRequired` with names of non-matching entries
  - [x] 2.4: For each `OPTIONAL_PATTERNS` entry, check files similarly; populate `optionalFound` with matching file paths
  - [x] 2.5: Set `valid: missingRequired.length === 0`

- [x] Task 3: Implement `ingestArtifacts` method on `WorkspaceManager` (AC: #4)
  - [x] 3.1: Implement `async ingestArtifacts(artifactsPath: string): Promise<void>`
  - [x] 3.2: Use `readdir` to list all files in `artifactsPath`
  - [x] 3.3: Use `copyFile` from `node:fs/promises` to copy each file into `this.artifactsPath`
  - [x] 3.4: Use `Promise.all` for parallel copies (consistent with `initialize()` pattern)
  - [x] 3.5: The workspace must already be initialized (`initialize()` called) before `ingestArtifacts()` — no need to guard, this is a caller responsibility documented here

- [x] Task 4: Export `ArtifactValidationResult` from `src/workspace/index.ts` (AC: all)
  - [x] 4.1: Add `export type { ArtifactValidationResult } from './workspace-manager.js'` to `src/workspace/index.ts`

- [x] Task 5: Write co-located tests in `src/workspace/workspace-manager.test.ts` (AC: #1, #2, #3, #4)
  - [x] 5.1: Use `mkdtemp` + `os.tmpdir()` for isolated temp dirs (same pattern as Story 2.1 tests)
  - [x] 5.2: Test `validateArtifacts` returns `valid: true` when all 3 required docs are present
  - [x] 5.3: Test `validateArtifacts` returns `valid: false` and populates `missingRequired` when a required doc is absent
  - [x] 5.4: Test `validateArtifacts` populates `optionalFound` when optional docs are present (without requiring them)
  - [x] 5.5: Test `validateArtifacts` returns empty `optionalFound` when no optional docs are present (no error)
  - [x] 5.6: Test `ingestArtifacts` copies all files from source dir into `this.artifactsPath`
  - [x] 5.7: Run `npm test` to confirm all tests pass with no regressions (expect 73 + new tests)
  - [x] 5.8: Test `validateArtifacts` returns `valid: false` with all required missing when `artifactsPath` does not exist (ENOENT graceful fallback)
  - [x] 5.9: Test `validateArtifacts` returns `valid: false` when artifacts directory is empty
  - [x] 5.10: Test `validateArtifacts` captures all matching files when multiple files match one pattern (e.g. `epic-1.md` + `epic-2.md`)
  - [x] 5.11: Test `ingestArtifacts` does not crash when source directory is empty
  - [x] 5.12: Test `ingestArtifacts` copies only files, skipping subdirectories

## Dev Notes

### Architecture Requirements

- **Module location:** `src/workspace/workspace-manager.ts` — all artifact validation and ingestion lives here, per architecture doc. The build command (Epic 3) will call these methods; it never reads the artifacts directory itself.
- **No new module files:** Everything in this story goes into the existing `workspace-manager.ts` and its test file. Do NOT create `artifact-validator.ts`, `artifact-ingestion.ts`, or any new module file.
- **Dependency injection:** `WorkspaceManager` already receives `workspacePath` via constructor. `validateArtifacts(artifactsPath)` and `ingestArtifacts(artifactsPath)` accept the source artifacts path as a parameter — they do NOT read `AppConfig` directly.
- **No new module directories:** `src/workspace/` is already established from Story 2.1. `src/workspace/types.ts` is NOT created in this story — that is Story 2.3's responsibility (it defines state file types like `StoryStatus`, `EpicStatus`). Export `ArtifactValidationResult` directly from `workspace-manager.ts`.
- **Async only:** All file I/O uses `node:fs/promises` (not `fs` or sync variants). Pattern: `import { readdir, copyFile } from 'node:fs/promises'`.
- **`Promise.all` for parallelism:** Copy all artifact files in parallel with `Promise.all`, consistent with the `initialize()` implementation added during Story 2.1 code review.

### Required vs Optional Artifact Patterns

From architecture doc (Gap 2 resolution):

| Category | Name | Pattern |
|----------|------|---------|
| Required | PRD | `*prd*.md` (case-insensitive) |
| Required | Architecture | `*architecture*.md` (case-insensitive) |
| Required | Epics/Stories | `*epic*.md` OR `*stories*.md` (case-insensitive) |
| Optional | UX Design | `*ux*.md` (case-insensitive) |
| Optional | Research | `*research*.md` (case-insensitive) |

Implement as constants at the module level (not inside the class):

```typescript
const REQUIRED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'PRD', pattern: /prd.*\.md$/i },
  { name: 'Architecture', pattern: /architecture.*\.md$/i },
  { name: 'Epics/Stories', pattern: /(epic|stories).*\.md$/i },
]

const OPTIONAL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'UX Design', pattern: /ux.*\.md$/i },
  { name: 'Research', pattern: /research.*\.md$/i },
]
```

> **Note:** Use `.test(filename)` against the basename only — not the full path — so the regex is not accidentally matched by directory names in the path.

### Implementation Sketch

```typescript
import { mkdir, readdir, copyFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'

export interface ArtifactValidationResult {
  valid: boolean
  requiredFound: string[]   // absolute paths of matched required files
  missingRequired: string[] // human-readable names of missing required docs
  optionalFound: string[]   // absolute paths of matched optional files
}

// (constants REQUIRED_PATTERNS and OPTIONAL_PATTERNS defined above)

export class WorkspaceManager {
  // ... existing code unchanged ...

  async validateArtifacts(artifactsPath: string): Promise<ArtifactValidationResult> {
    const entries = await readdir(artifactsPath)
    const mdFiles = entries.filter(f => f.endsWith('.md'))

    const requiredFound: string[] = []
    const missingRequired: string[] = []
    for (const { name, pattern } of REQUIRED_PATTERNS) {
      const match = mdFiles.find(f => pattern.test(basename(f)))
      if (match) {
        requiredFound.push(join(artifactsPath, match))
      } else {
        missingRequired.push(name)
      }
    }

    const optionalFound: string[] = []
    for (const { name: _name, pattern } of OPTIONAL_PATTERNS) {
      const match = mdFiles.find(f => pattern.test(basename(f)))
      if (match) {
        optionalFound.push(join(artifactsPath, match))
      }
    }

    return {
      valid: missingRequired.length === 0,
      requiredFound,
      missingRequired,
      optionalFound,
    }
  }

  async ingestArtifacts(artifactsPath: string): Promise<void> {
    const entries = await readdir(artifactsPath)
    await Promise.all(
      entries.map(filename =>
        copyFile(join(artifactsPath, filename), join(this.artifactsPath, filename))
      )
    )
  }
}
```

**Key decisions:**
- `validateArtifacts` uses `basename(f)` for pattern matching — robust against directory components in the path
- `ingestArtifacts` copies ALL files (not just validated ones) — agents may need all supporting docs
- `ingestArtifacts` does NOT call `validateArtifacts` internally — these are separate concerns; the caller (build command in Epic 3) validates first, then ingests
- Both methods are pure filesystem operations and throw naturally on I/O errors — no additional error wrapping needed; the orchestrator (Epic 3) will catch and categorize

### Updated `src/workspace/index.ts`

Add type export alongside the existing `WorkspaceManager` export:

```typescript
export { WorkspaceManager } from './workspace-manager.js'
export type { ArtifactValidationResult } from './workspace-manager.js'
```

### Testing Pattern

```typescript
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { WorkspaceManager } from './workspace-manager.js'

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
})
```

### Project Structure Notes

**Files to MODIFY:**
```
src/workspace/workspace-manager.ts      # Add ArtifactValidationResult type, validateArtifacts(), ingestArtifacts()
src/workspace/workspace-manager.test.ts # Add tests for validateArtifacts and ingestArtifacts
src/workspace/index.ts                  # Add: export type { ArtifactValidationResult } from './workspace-manager.js'
```

**Files NOT to touch:**
```
src/workspace/state-manager.ts    # Story 2.3 — does not exist yet, do not create
src/workspace/failure-notes.ts    # Story 4.1 — does not exist yet, do not create
src/workspace/types.ts            # Story 2.3 — does not exist yet, do not create
src/config/                       # No changes
src/cli/                          # No changes
src/errors/                       # No changes
src/orchestrator/                 # Epic 3 — no changes
src/agents/                       # Epic 3 — no changes
src/cost/                         # Epic 5 — no changes
src/output/                       # Epic 5 — no changes
```

### Previous Story Intelligence (Story 2.1)

**From Story 2.1 completion notes:**
- 73 tests currently passing (71 dev + 2 from code review)
- `WorkspaceManager` exists at `src/workspace/workspace-manager.ts` with:
  - Constructor: `constructor(workspacePath: string)`
  - `readonly` properties: `workspacePath`, `artifactsPath` (`join(workspacePath, 'artifacts')`), `storiesPath` (`join(workspacePath, 'stories')`)
  - `initialize(): Promise<void>` — uses `Promise.all` + recursive mkdir (idempotent)
  - `ensureStoryDirectory(storyKey: string): Promise<string>` — validates key against regex, resolves path, creates `stories/{key}/failures/`, returns story dir path
- Code review (Story 2.1) added: path traversal validation, `Promise.all` in `initialize()`, guard in test `afterEach`
- All imports use `node:` prefix: `import { mkdir } from 'node:fs/promises'`
- Test files use `import { describe, it, expect, afterEach } from 'vitest'`
- `moduleResolution` is `"bundler"` in tsconfig — relative imports within a module use `.js` extension (e.g., `'./workspace-manager.js'`)
- Barrel re-export pattern established: named exports, `.js` extension
- All errors propagate naturally from `fs` operations — no additional wrapping in workspace module

**Established patterns to continue:**
- `node:` prefix for all Node.js built-in imports
- `Promise.all` for parallel I/O
- No singletons — `WorkspaceManager` is always instantiated with a constructor-injected path
- Co-located test file: `workspace-manager.test.ts` in same directory as `workspace-manager.ts`
- Use `mkdtemp` + `afterEach` cleanup for test isolation (use `beforeEach` now since we have multiple describe blocks)

### Anti-Patterns to Avoid

- **DO NOT** create `src/workspace/artifact-validator.ts` — validation belongs in `workspace-manager.ts`
- **DO NOT** create `src/workspace/types.ts` — that is Story 2.3 (state file types)
- **DO NOT** use `fs.readdirSync` or `fs.copyFileSync` — all I/O must be async (`node:fs/promises`)
- **DO NOT** use the `glob` package — it is not in the project dependencies; use `readdir` + `.filter()`
- **DO NOT** call `validateArtifacts` inside `ingestArtifacts` — they are separate concerns
- **DO NOT** throw `AgentError` — validation failures are returned as `ArtifactValidationResult`; the orchestrator (Epic 3) is responsible for converting `valid: false` to a user-facing error
- **DO NOT** use `fs` from `'node:fs'` directly — always use `'node:fs/promises'`
- **DO NOT** use `import { globSync }` or similar — not available without adding a new dependency
- **DO NOT** import from `'../../config/...'` — if config is ever needed, use `@/config`

### References

- [Source: docs/planning-artifacts/architecture.md#Gaps-Identified-and-Resolved] — "Gap 2: BMAD Artifact Validation — Required: PRD (*prd*.md), Architecture doc (*architecture*.md), Epics/Stories (*epic*.md or *stories*.md). Optional: UX Design (*ux*.md), Research docs (*research*.md). Validation lives in workspace/workspace-manager.ts as part of artifact ingestion."
- [Source: docs/planning-artifacts/architecture.md#Workspace-Directory-Structure] — `.startup-factory/artifacts/` is the destination for ingested BMAD planning artifacts
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — async/await only, `node:` prefix for builtins, function parameter DI, no DI framework
- [Source: docs/planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — `src/workspace/workspace-manager.ts` maps to FR13-16 (FR2: validate BMAD artifacts, FR13: maintain shared workspace, FR14-16: agents read/write workspace)
- [Source: docs/planning-artifacts/epics.md#Story-2.2] — Story requirements and all acceptance criteria
- [Source: docs/implementation-artifacts/2-1-workspace-initialization-directory-structure.md#Completion-Notes-List] — 73 tests passing; path traversal fix; Promise.all pattern; node: prefix convention confirmed
- [Source: docs/implementation-artifacts/2-1-workspace-initialization-directory-structure.md#WorkspaceManager-Implementation-Pattern] — Constructor, readonly props, existing method signatures

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Implemented `ArtifactValidationResult` interface and exported from `workspace-manager.ts`
- Added module-level `REQUIRED_PATTERNS` (PRD, Architecture, Epics/Stories) and `OPTIONAL_PATTERNS` (UX Design, Research) constants using case-insensitive RegExp
- Implemented `validateArtifacts(artifactsPath)`: uses `readdir` with `withFileTypes: true` to list `.md` files (skipping subdirs), matches ALL files per pattern using `filter` (not just first), returns structured result
  - **ENOENT contract**: if `artifactsPath` does not exist, returns `valid: false` with all required missing — never throws for ENOENT; callers can rely on this
  - Uses `filter` (not `find`) so all matching files per category appear in `requiredFound`/`optionalFound` — e.g. `epic-1.md` and `epic-2.md` both populate `requiredFound`
- Implemented `ingestArtifacts(artifactsPath)`: reads dir with `withFileTypes: true`, copies only files (subdirectories are intentionally skipped — agents read from a flat `artifacts/` dir), uses `Promise.all` for parallel copies
- Exported `ArtifactValidationResult` type from `src/workspace/index.ts`
- Added 10 new tests in two `describe` blocks using `beforeEach`/`afterEach` with `mkdtemp` isolation:
  - `validateArtifacts`: valid all-present, valid:false missing required, optional found, empty optional, ENOENT graceful, empty dir, multiple matches per pattern
  - `ingestArtifacts`: copies all files, empty source (no crash), skips subdirectories
- Full test suite: 83 tests passing (73 pre-existing + 10 new), 0 failures, 0 regressions

### File List

- `src/workspace/workspace-manager.ts` (modified — added type, constants, validateArtifacts, ingestArtifacts)
- `src/workspace/workspace-manager.test.ts` (modified — added validateArtifacts and ingestArtifacts test suites)
- `src/workspace/index.ts` (modified — added ArtifactValidationResult type export)

## Change Log

- 2026-03-05: Implemented Story 2.2 — added `ArtifactValidationResult` type, `validateArtifacts()`, and `ingestArtifacts()` to `WorkspaceManager`; exported type from barrel; added 10 tests; 83 total tests passing
- 2026-03-05: Code review — fixed `validateArtifacts` to capture ALL matching files per pattern (find→filter); documented ENOENT contract and subdirectory-skipping behavior in code comments; corrected Completion Notes test count (was 78/5 new, actual 83/10 new); added 5 missing test subtasks (5.8–5.12)
