# Story 2.1: Workspace Initialization & Directory Structure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to create and manage a `.startup-factory/` workspace directory with proper structure,
so that agents have a consistent filesystem layout for reading and writing artifacts.

## Acceptance Criteria

1. **Given** an operator initiates a build, **When** the workspace manager initializes, **Then** it creates the `.startup-factory/` directory with subdirectories: `artifacts/`, `stories/`, **And** the workspace path is configurable via the config file.

2. **Given** the workspace already exists from a previous run, **When** the workspace manager initializes, **Then** it preserves existing content and does not overwrite previous story outputs.

3. **Given** a story needs a workspace directory, **When** the workspace manager creates a story directory, **Then** it follows the `{epic}-{story}` naming convention (e.g., `stories/1-1/`), **And** creates subdirectories for `failures/` within each story directory.

## Tasks / Subtasks

- [x] Task 1: Create `WorkspaceManager` class in `src/workspace/workspace-manager.ts` (AC: #1, #2)
  - [x] 1.1: Define `WorkspaceManager` class with a constructor accepting `workspacePath: string`
  - [x] 1.2: Implement `initialize(): Promise<void>` — creates `artifacts/` and `stories/` subdirectories using `fs.mkdir` with `{ recursive: true }` (idempotent, safe to call multiple times)
  - [x] 1.3: Store `workspacePath`, `artifactsPath`, and `storiesPath` as readonly instance properties for downstream use

- [x] Task 2: Implement `ensureStoryDirectory` method (AC: #3)
  - [x] 2.1: Implement `ensureStoryDirectory(storyKey: string): Promise<string>` where `storyKey` is the `{epic}-{story}` string (e.g., `'1-1'`)
  - [x] 2.2: Create `stories/{storyKey}/` and `stories/{storyKey}/failures/` using `fs.mkdir` with `{ recursive: true }`
  - [x] 2.3: Return the resolved story directory path as a string for caller use

- [x] Task 3: Update barrel exports (AC: all)
  - [x] 3.1: Replace the empty `export {}` in `src/workspace/index.ts` with `export { WorkspaceManager } from './workspace-manager.js'`

- [x] Task 4: Write co-located tests (AC: #1, #2, #3)
  - [x] 4.1: Create `src/workspace/workspace-manager.test.ts` using Vitest
  - [x] 4.2: Use Node.js `fs/promises` and `os.tmpdir()` to create isolated temp directories per test; clean up in `afterEach`
  - [x] 4.3: Test `initialize()` creates `artifacts/` and `stories/` subdirectories
  - [x] 4.4: Test `initialize()` is idempotent (calling twice does not throw or overwrite)
  - [x] 4.5: Test `ensureStoryDirectory('1-1')` creates `stories/1-1/` and `stories/1-1/failures/` directories
  - [x] 4.6: Test `ensureStoryDirectory` returns the correct story directory path
  - [x] 4.7: Run `npm test` to verify all tests pass and no regressions

## Dev Notes

### Architecture Requirements

- **Module location:** `src/workspace/` — all workspace/filesystem management lives here. Other modules import via `@/workspace` (path alias), never with relative cross-module paths.
- **Configurable path:** `workspacePath` comes from `AppConfig.workspacePath`, defaulting to `.startup-factory/`. The `WorkspaceManager` is instantiated by the orchestrator (Epic 3) with the resolved path from config — it never reads config itself.
- **Dependency injection pattern:** `WorkspaceManager` receives `workspacePath` as a constructor argument. No module-level singletons; no direct config imports. This pattern is consistent across all modules.
- **No types.ts yet:** Story 2.1 does not require a `types.ts` — state file types (StoryStatus, EpicStatus, etc.) are defined in Story 2.3. Do not create `types.ts` in this story.
- **Idempotent initialization:** Use `fs.mkdir(path, { recursive: true })` throughout — this is the correct Node.js pattern for "create if not exists". Never check existence before creating; always use recursive mkdir.
- **Only create what's needed:** This story scopes to workspace directory initialization only. BMAD artifact ingestion (copying artifacts in) is Story 2.2's responsibility. State file creation is Story 2.3's responsibility.

### WorkspaceManager Implementation Pattern

```typescript
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export class WorkspaceManager {
  readonly workspacePath: string
  readonly artifactsPath: string
  readonly storiesPath: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.artifactsPath = join(workspacePath, 'artifacts')
    this.storiesPath = join(workspacePath, 'stories')
  }

  async initialize(): Promise<void> {
    await mkdir(this.artifactsPath, { recursive: true })
    await mkdir(this.storiesPath, { recursive: true })
  }

  async ensureStoryDirectory(storyKey: string): Promise<string> {
    const storyDir = join(this.storiesPath, storyKey)
    await mkdir(join(storyDir, 'failures'), { recursive: true })
    return storyDir
  }
}
```

**Key decisions:**
- Use `node:fs/promises` (not `fs`) — ES module style, matches existing codebase imports (see `src/config/config-loader.ts` for precedent)
- Use `node:path` join for cross-platform path composition
- `ensureStoryDirectory` creates `failures/` in the same call — recursive mkdir on the deepest path creates all intermediaries
- Return story dir path for convenience — callers (Epic 3 orchestrator, failure notes module) need it immediately

### Workspace Directory Structure Being Created

```
.startup-factory/          ← workspacePath (configurable)
  artifacts/               ← artifactsPath (BMAD planning artifacts go here in Story 2.2)
  stories/                 ← storiesPath
    1-1/                   ← ensureStoryDirectory('1-1') creates this
      failures/            ← created alongside story dir
    1-2/
      failures/
    ...
```

**NOT created in this story:** `state.yaml` (Story 2.3), artifact file copies (Story 2.2).

### AppConfig Integration (Context for Epic 3)

The `AppConfig` type (defined in `src/config/types.ts`) has:
```typescript
interface AppConfig {
  workspacePath: string   // ← pass this to WorkspaceManager constructor
  artifactsPath: string   // ← separate field for BMAD artifacts input dir
  // ...
}
```

The orchestrator (Epic 3) will instantiate `WorkspaceManager` like:
```typescript
const workspaceManager = new WorkspaceManager(config.workspacePath)
await workspaceManager.initialize()
```

### Testing Pattern

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { WorkspaceManager } from './workspace-manager.js'

describe('WorkspaceManager', () => {
  let tempDir: string

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('initializes workspace subdirectories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
    const manager = new WorkspaceManager(join(tempDir, '.startup-factory'))
    await manager.initialize()
    // Verify directories exist using access or stat
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
})
```

**Note on `access()`:** `fs.access()` with no mode argument checks existence (F_OK). It resolves if the path exists, rejects otherwise. Using `resolves.toBeUndefined()` is idiomatic for checking existence in Vitest.

### Project Structure Notes

**Files to CREATE:**
```
src/workspace/workspace-manager.ts       # WorkspaceManager class
src/workspace/workspace-manager.test.ts  # Co-located tests
```

**Files to MODIFY:**
```
src/workspace/index.ts  # Replace empty `export {}` with barrel export
```

**Files NOT to touch:**
```
src/workspace/state-manager.ts      # Story 2.3 — does not exist yet, don't create
src/workspace/failure-notes.ts      # Story 4.1 — does not exist yet, don't create
src/workspace/types.ts              # Story 2.3 — does not exist yet, don't create
src/config/                         # No changes
src/cli/                            # No changes
src/errors/                         # No changes
src/orchestrator/                   # Epic 3 — no changes
src/agents/                         # Epic 3 — no changes
```

**No new module directories needed** — `src/workspace/` already exists from Story 1.1.

### Anti-Patterns to Avoid

- **DO NOT** use `fs.existsSync()` or `fs.mkdirSync()` — all I/O must be async (`fs/promises`)
- **DO NOT** check existence before creating directories — use `{ recursive: true }` which is inherently idempotent
- **DO NOT** import from `'../../config/...'` — if config is ever needed, use `@/config`
- **DO NOT** create `state.yaml` or write any files in this story — that is Stories 2.2 and 2.3
- **DO NOT** use `fs` from `'node:fs'` directly — use `'node:fs/promises'`
- **DO NOT** create a WorkspaceManager singleton at module level — it is always instantiated with an injected path
- **DO NOT** use `workspace_manager.ts` or `WorkspaceManager.ts` — files are always kebab-case

### Previous Story Intelligence

**From Story 1.3 (Error Types & Exit Codes):**
- 67 tests currently passing (56 pre-existing + 8 from 1.3 + 3 from code review fixes)
- All test files use `import { describe, it, expect } from 'vitest'`
- `moduleResolution` is `"bundler"` in tsconfig — relative imports within a module use `.js` extension (e.g., `'./workspace-manager.js'`)
- Barrel re-export pattern: `export { WorkspaceManager } from './workspace-manager.js'`
- `node:` prefix on built-in modules is the convention in this codebase (see `src/config/config-loader.ts` imports)
- Tests co-located with source: `workspace-manager.test.ts` sits beside `workspace-manager.ts`
- All errors use typed classes — never raw `throw new Error(...)`. For this story, filesystem errors from `fs.mkdir` are let to propagate naturally (they are system-level failures the caller handles)

**From Story 1.1 (Project Scaffold):**
- `src/workspace/index.ts` currently contains `export {}` — replace completely
- All 8 module directories were scaffolded in Story 1.1 with empty barrels

**From Story 1.2 (Config Loading):**
- `AppConfig.workspacePath` defaults to `.startup-factory` (relative to CWD at runtime)
- `AppConfig.artifactsPath` is the INPUT path for BMAD artifacts — distinct from the workspace

### References

- [Source: docs/planning-artifacts/architecture.md#Workspace-Directory-Structure] — `.startup-factory/` structure, naming convention, `artifacts/`, `stories/`, `{epic}-{story}/`, `failures/`
- [Source: docs/planning-artifacts/architecture.md#Core-Architectural-Decisions] — Decision: "Hidden dotfile workspace with epic-story directory naming using BMAD identifiers"
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — async/await only, `node:` prefix for builtins, function parameter DI, kebab-case files, co-located tests
- [Source: docs/planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — `src/workspace/workspace-manager.ts` maps to FR13-16; Workspace Manager boundary: "Orchestrator reads/writes state through StateManager — never touches state.yaml directly"
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/workspace/workspace-manager.ts`, `src/workspace/workspace-manager.test.ts`
- [Source: docs/planning-artifacts/epics.md#Story-2.1] — Story requirements and all acceptance criteria
- [Source: docs/planning-artifacts/epics.md#Additional-Requirements] — "Hidden dotfile workspace (.startup-factory/) with epic-story directory naming"
- [Source: docs/implementation-artifacts/1-3-error-types-exit-codes.md#Completion-Notes-List] — 67 tests passing; process-handlers.ts pattern for module separation
- [Source: docs/implementation-artifacts/1-3-error-types-exit-codes.md#Dev-Notes] — `.js` extension on relative imports, `node:` prefix convention

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `WorkspaceManager` class with constructor-injected `workspacePath`, readonly properties `artifactsPath` and `storiesPath`, `initialize()` using recursive mkdir for idempotence, and `ensureStoryDirectory(storyKey)` that creates story + failures dirs and returns the story path.
- Barrel export updated in `src/workspace/index.ts`.
- 4 new tests added by dev agent; all 71 tests passed.
- Used `node:fs/promises` and `node:path` per codebase conventions. `ensureStoryDirectory` creates the deepest path (`failures/`) in one `mkdir` call — recursive mkdir creates all intermediaries.
- Code review pass 1 (2026-03-05): Added path traversal validation and input sanitization to `ensureStoryDirectory` (regex check + resolve boundary check). Parallelized `initialize()` mkdir calls with `Promise.all`. Fixed uninitialized `tempDir` guard in test `afterEach`. Added 2 new tests: `ensureStoryDirectory` idempotency and invalid storyKey rejection. 73 tests passing (was 71).
- Code review pass 2 (2026-03-05): Fixed path traversal boundary check to use `path.sep` instead of hardcoded `'/'` (platform-correct). Switched `validateArtifacts` to use `readdir({withFileTypes:true})` + ENOENT guard (returns structured result on missing path instead of throwing). Switched `ingestArtifacts` to filter only files via `d.isFile()` (prevents EISDIR crash on subdirectories in source). Removed now-unused `basename` import. Added 4 new tests: validateArtifacts with nonexistent path, validateArtifacts with empty dir, ingestArtifacts with empty source, ingestArtifacts skips subdirectories. 82 tests passing (was 78).

### File List

- src/workspace/workspace-manager.ts (created; modified by code review — path traversal fix, Promise.all)
- src/workspace/workspace-manager.test.ts (created; modified by code review — afterEach guard, 2 new tests)
- src/workspace/index.ts (modified)
