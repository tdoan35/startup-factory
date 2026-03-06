# Story 2.3: State File Management with Atomic Writes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to track pipeline state in a YAML state file with crash-safe atomic writes,
so that state is never corrupted by unclean exits and partial progress is always preserved.

## Acceptance Criteria

1. **Given** a build is starting with a set of epics and stories, **When** the state manager initializes state, **Then** it creates `state.yaml` with the hierarchical schema: run-level metadata (`status`, `started`, `config` snapshot, `totalCost`) and epic-level story entries (`status: pending`, `phase: pending` for each story).

2. **Given** a story completes a pipeline phase, **When** the state manager updates the story, **Then** it writes the updated state using atomic writes (write to `.state.yaml.tmp`, then rename to `state.yaml`) **And** the story's `status`, `phase`, `attempts` count, and `cost` are updated correctly.

3. **Given** the process crashes mid-write (only the `.state.yaml.tmp` file is affected), **When** the system restarts and reads state, **Then** `state.yaml` contains either the previous complete state or the new complete state, never a partial write.

4. **Given** the state file exists from a previous run, **When** the state manager reads state, **Then** it correctly parses the hierarchical YAML schema and returns typed state objects **And** it can enumerate stories by status (`pending`, `in-progress`, `completed`, `failed`).

## Tasks / Subtasks

- [x] Task 1: Create `src/workspace/types.ts` with all state file types (AC: #1, #2, #4)
  - [x] 1.1: Define and export `StoryStatus` as union type: `'pending' | 'in-progress' | 'completed' | 'failed'`
  - [x] 1.2: Define and export `EpicStatus` as union type: `'pending' | 'in-progress' | 'completed'`
  - [x] 1.3: Define and export `StoryPhase` as union type: `'pending' | 'storyCreation' | 'development' | 'codeReview' | 'qa' | 'completed' | 'failed'`
  - [x] 1.4: Define and export `RunStatus` as union type: `'running' | 'completed' | 'partial' | 'failed'`
  - [x] 1.5: Define and export `ConfigSnapshot` interface: `{ defaultModel: string; maxRetries: number }`
  - [x] 1.6: Define and export `RunMeta` interface: `{ status: RunStatus; started: string; config: ConfigSnapshot; totalCost: number }`
  - [x] 1.7: Define and export `StoryState` interface: `{ status: StoryStatus; phase: StoryPhase; attempts: number; cost: number; escalationTier?: number; failureNote?: string }`
  - [x] 1.8: Define and export `EpicState` interface: `{ status: EpicStatus; stories: Record<string, StoryState> }`
  - [x] 1.9: Define and export `AppState` interface: `{ run: RunMeta; epics: Record<string, EpicState> }`

- [x] Task 2: Create `src/workspace/state-manager.ts` with `StateManager` class (AC: #1, #2, #3, #4)
  - [x] 2.1: Constructor accepts `workspacePath: string`; set `readonly statePath = join(workspacePath, 'state.yaml')` and `private readonly tempPath = join(workspacePath, '.state.yaml.tmp')`
  - [x] 2.2: Implement `initialize(epics: Array<{ epicKey: string; storyKeys: string[] }>, config: ConfigSnapshot): Promise<void>` — builds initial `AppState` (run: status `running`, started ISO timestamp, config, totalCost 0; each epic with status `pending`; each story with status `pending`, phase `pending`, attempts 0, cost 0) and calls the private `write()` method
  - [x] 2.3: Implement `read(): Promise<AppState>` — reads `this.statePath` using `readFile` then parses with `yaml.parse()`; throws naturally on ENOENT (callers are responsible for calling `initialize()` first)
  - [x] 2.4: Implement `private async write(state: AppState): Promise<void>` — atomic write: `await writeFile(this.tempPath, stringify(state))` then `await rename(this.tempPath, this.statePath)`. The `rename` syscall is atomic on POSIX filesystems — state.yaml is never partially written.
  - [x] 2.5: Implement `updateStory(epicKey: string, storyKey: string, updates: Partial<StoryState>): Promise<void>` — `read()` → merge `updates` into `state.epics[epicKey].stories[storyKey]` with spread → `write(state)`. Throw with a descriptive `Error` if the epic/story key is not found.
  - [x] 2.6: Implement `updateRun(updates: Partial<RunMeta>): Promise<void>` — `read()` → merge `updates` into `state.run` with spread → `write(state)`
  - [x] 2.7: Implement `getStoriesByStatus(status: StoryStatus): Promise<Array<{ epicKey: string; storyKey: string } & StoryState>>` — `read()` → iterate all epics and their stories, collect entries where `story.status === status`, return as flat array with `epicKey` and `storyKey` added to each entry

- [x] Task 3: Export types and `StateManager` from `src/workspace/index.ts` (AC: all)
  - [x] 3.1: Add `export { StateManager } from './state-manager.js'`
  - [x] 3.2: Add `export type { AppState, EpicState, StoryState, RunMeta, ConfigSnapshot, StoryStatus, EpicStatus, StoryPhase, RunStatus } from './types.js'`

- [x] Task 4: Write co-located tests in `src/workspace/state-manager.test.ts` (AC: #1, #2, #3, #4)
  - [x] 4.1: Use `mkdtemp` + `beforeEach`/`afterEach` for isolated temp dirs (same pattern as workspace-manager.test.ts)
  - [x] 4.2: Test `initialize()` creates `state.yaml` at the correct path
  - [x] 4.3: Test `initialize()` sets run metadata: `status: 'running'`, `totalCost: 0`, `config` matches input
  - [x] 4.4: Test `initialize()` sets all stories to `status: 'pending'`, `phase: 'pending'`, `attempts: 0`, `cost: 0`
  - [x] 4.5: Test `read()` returns a correctly typed `AppState` after `initialize()`
  - [x] 4.6: Test `updateStory()` merges partial updates into the story and persists to disk (verify by calling `read()` after)
  - [x] 4.7: Test `updateStory()` throws descriptively if epic key not found
  - [x] 4.8: Test `updateStory()` throws descriptively if story key not found
  - [x] 4.9: Test `updateRun()` merges partial updates into run metadata and persists to disk
  - [x] 4.10: Test `getStoriesByStatus('pending')` returns all initial pending stories
  - [x] 4.11: Test `getStoriesByStatus('completed')` returns empty array when no stories are completed
  - [x] 4.12: Test `getStoriesByStatus()` correctly filters after `updateStory()` changes a story's status
  - [x] 4.13: Test atomic write: `.state.yaml.tmp` does not exist after a successful `write()` (rename cleaned it up)
  - [x] 4.14: Test crash-safety contract: if `.state.yaml.tmp` exists (leftover from crashed write) and `state.yaml` exists, `read()` returns the intact `state.yaml` data — NOT the temp file
  - [x] 4.15: Run `npm test` to confirm all tests pass with no regressions (expect 83 + new tests)

## Dev Notes

### Architecture Requirements

- **New files to CREATE:**
  - `src/workspace/types.ts` — all state file types (Story 2.2 deliberately deferred this here)
  - `src/workspace/state-manager.ts` — StateManager class
  - `src/workspace/state-manager.test.ts` — co-located tests
- **File to MODIFY:** `src/workspace/index.ts` — add StateManager and type exports
- **Files NOT to touch:** `src/workspace/workspace-manager.ts` (Story 2.2 is done), `src/workspace/workspace-manager.test.ts`

- **Module location:** `src/workspace/state-manager.ts` per architecture doc. State management is a workspace-module concern.
- **No new module directories:** `src/workspace/` already exists.
- **Dependency injection:** `StateManager` receives `workspacePath` via constructor — same pattern as `WorkspaceManager`. Never reads `AppConfig` directly.
- **`yaml` package already installed:** It is a production dependency (used by config-loader in Epic 1). Import as `import { parse, stringify } from 'yaml'` — no `node:` prefix (it's a third-party package, not a Node built-in).
- **Async only:** All file I/O uses `node:fs/promises`. Import: `import { readFile, writeFile, rename } from 'node:fs/promises'`.
- **No error wrapping:** Let `readFile` throw naturally if `state.yaml` doesn't exist (ENOENT). Callers are responsible for calling `initialize()` before `read()`.

### Atomic Write Pattern (Critical — Implements NFR13)

The crash-safe write sequence:

```typescript
private async write(state: AppState): Promise<void> {
  await writeFile(this.tempPath, stringify(state))
  await rename(this.tempPath, this.statePath)
}
```

Why this is crash-safe:
- If the process crashes during `writeFile(tempPath)`: `state.yaml` is untouched (the previous complete state is preserved)
- If the process crashes after `writeFile` but before `rename`: the `.state.yaml.tmp` is a valid complete file but `state.yaml` still holds the previous complete state. On restart, `read()` reads from `state.yaml` — ignores the orphaned `.tmp`
- `rename` is atomic on POSIX filesystems: the directory entry is swapped in one syscall. There is no instant where neither file exists.

**The `.state.yaml.tmp` file is only the temp buffer. `read()` always reads from `state.yaml`. Never read from `.tmp`.**

### Types Reference

Full type definitions for `src/workspace/types.ts`:

```typescript
export type StoryStatus = 'pending' | 'in-progress' | 'completed' | 'failed'
export type EpicStatus = 'pending' | 'in-progress' | 'completed'
export type StoryPhase = 'pending' | 'storyCreation' | 'development' | 'codeReview' | 'qa' | 'completed' | 'failed'
export type RunStatus = 'running' | 'completed' | 'partial' | 'failed'

export interface ConfigSnapshot {
  defaultModel: string
  maxRetries: number
}

export interface RunMeta {
  status: RunStatus
  started: string        // ISO 8601 timestamp, e.g., "2026-03-05T22:00:00.000Z"
  config: ConfigSnapshot
  totalCost: number
}

export interface StoryState {
  status: StoryStatus
  phase: StoryPhase
  attempts: number
  cost: number
  escalationTier?: number
  failureNote?: string   // relative path, e.g., "stories/1-2/failures/attempt-3.md"
}

export interface EpicState {
  status: EpicStatus
  stories: Record<string, StoryState>
}

export interface AppState {
  run: RunMeta
  epics: Record<string, EpicState>
}
```

### StateManager Implementation Sketch

```typescript
import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import type {
  AppState, RunMeta, StoryState, StoryStatus, ConfigSnapshot,
} from './types.js'

export class StateManager {
  readonly statePath: string
  private readonly tempPath: string

  constructor(workspacePath: string) {
    this.statePath = join(workspacePath, 'state.yaml')
    this.tempPath = join(workspacePath, '.state.yaml.tmp')
  }

  async initialize(
    epics: Array<{ epicKey: string; storyKeys: string[] }>,
    config: ConfigSnapshot,
  ): Promise<void> {
    const state: AppState = {
      run: {
        status: 'running',
        started: new Date().toISOString(),
        config,
        totalCost: 0,
      },
      epics: Object.fromEntries(
        epics.map(({ epicKey, storyKeys }) => [
          epicKey,
          {
            status: 'pending' as const,
            stories: Object.fromEntries(
              storyKeys.map(key => [
                key,
                { status: 'pending' as const, phase: 'pending' as const, attempts: 0, cost: 0 },
              ])
            ),
          },
        ])
      ),
    }
    await this.write(state)
  }

  async read(): Promise<AppState> {
    const content = await readFile(this.statePath, 'utf-8')
    return parse(content) as AppState
  }

  private async write(state: AppState): Promise<void> {
    await writeFile(this.tempPath, stringify(state))
    await rename(this.tempPath, this.statePath)
  }

  async updateStory(
    epicKey: string,
    storyKey: string,
    updates: Partial<StoryState>,
  ): Promise<void> {
    const state = await this.read()
    const story = state.epics[epicKey]?.stories[storyKey]
    if (!story) {
      throw new Error(`Story not found in state: ${epicKey}/${storyKey}`)
    }
    state.epics[epicKey].stories[storyKey] = { ...story, ...updates }
    await this.write(state)
  }

  async updateRun(updates: Partial<RunMeta>): Promise<void> {
    const state = await this.read()
    state.run = { ...state.run, ...updates }
    await this.write(state)
  }

  async getStoriesByStatus(
    status: StoryStatus,
  ): Promise<Array<{ epicKey: string; storyKey: string } & StoryState>> {
    const state = await this.read()
    const results: Array<{ epicKey: string; storyKey: string } & StoryState> = []
    for (const [epicKey, epic] of Object.entries(state.epics)) {
      for (const [storyKey, story] of Object.entries(epic.stories)) {
        if (story.status === status) {
          results.push({ epicKey, storyKey, ...story })
        }
      }
    }
    return results
  }
}
```

### Updated `src/workspace/index.ts`

```typescript
export { WorkspaceManager } from './workspace-manager.js'
export type { ArtifactValidationResult } from './workspace-manager.js'
export { StateManager } from './state-manager.js'
export type {
  AppState,
  EpicState,
  StoryState,
  RunMeta,
  ConfigSnapshot,
  StoryStatus,
  EpicStatus,
  StoryPhase,
  RunStatus,
} from './types.js'
```

### Expected State File Output

After `initialize([{ epicKey: 'epic-1', storyKeys: ['1-1', '1-2'] }], { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 })`, `state.yaml` should look like:

```yaml
run:
  status: running
  started: 2026-03-05T22:00:00.000Z
  config:
    defaultModel: claude-sonnet-4-6
    maxRetries: 3
  totalCost: 0
epics:
  epic-1:
    status: pending
    stories:
      1-1:
        status: pending
        phase: pending
        attempts: 0
        cost: 0
      1-2:
        status: pending
        phase: pending
        attempts: 0
        cost: 0
```

All YAML field names are camelCase per architecture doc.

### Testing Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StateManager } from './state-manager.js'

const TEST_EPICS = [
  { epicKey: 'epic-1', storyKeys: ['1-1', '1-2'] },
  { epicKey: 'epic-2', storyKeys: ['2-1'] },
]
const TEST_CONFIG = { defaultModel: 'claude-sonnet-4-6', maxRetries: 3 }

describe('StateManager', () => {
  let tempDir: string
  let manager: StateManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'state-test-'))
    manager = new StateManager(tempDir)
  })

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('initialize() creates state.yaml at statePath', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await stat(manager.statePath) // throws if not found
  })

  it('initialize() sets run metadata correctly', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const state = await manager.read()
    expect(state.run.status).toBe('running')
    expect(state.run.totalCost).toBe(0)
    expect(state.run.config).toEqual(TEST_CONFIG)
    expect(state.run.started).toBeTruthy()
  })

  it('initialize() sets all stories to pending with zero attempts and cost', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1']).toEqual({
      status: 'pending',
      phase: 'pending',
      attempts: 0,
      cost: 0,
    })
  })

  it('updateStory() merges updates and persists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-1', '1-1', { status: 'in-progress', phase: 'development', attempts: 1 })
    const state = await manager.read()
    expect(state.epics['epic-1'].stories['1-1'].status).toBe('in-progress')
    expect(state.epics['epic-1'].stories['1-1'].phase).toBe('development')
    expect(state.epics['epic-1'].stories['1-1'].attempts).toBe(1)
  })

  it('updateStory() throws when epic key not found', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(
      manager.updateStory('epic-99', '1-1', { status: 'completed' })
    ).rejects.toThrow()
  })

  it('updateStory() throws when story key not found', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(
      manager.updateStory('epic-1', '9-9', { status: 'completed' })
    ).rejects.toThrow()
  })

  it('updateRun() merges partial updates and persists', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateRun({ status: 'completed', totalCost: 1.23 })
    const state = await manager.read()
    expect(state.run.status).toBe('completed')
    expect(state.run.totalCost).toBe(1.23)
    // config should remain intact
    expect(state.run.config).toEqual(TEST_CONFIG)
  })

  it('getStoriesByStatus() returns all pending stories initially', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const pending = await manager.getStoriesByStatus('pending')
    expect(pending).toHaveLength(3) // 1-1, 1-2, 2-1
  })

  it('getStoriesByStatus() returns empty array when no match', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const completed = await manager.getStoriesByStatus('completed')
    expect(completed).toHaveLength(0)
  })

  it('getStoriesByStatus() filters correctly after updateStory()', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await manager.updateStory('epic-1', '1-1', { status: 'completed' })
    const completed = await manager.getStoriesByStatus('completed')
    expect(completed).toHaveLength(1)
    expect(completed[0].epicKey).toBe('epic-1')
    expect(completed[0].storyKey).toBe('1-1')
    const pending = await manager.getStoriesByStatus('pending')
    expect(pending).toHaveLength(2)
  })

  it('atomic write: .state.yaml.tmp does not exist after successful write', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    await expect(stat(join(tempDir, '.state.yaml.tmp'))).rejects.toThrow()
  })

  it('crash-safety: state.yaml is intact when .state.yaml.tmp exists as leftover', async () => {
    await manager.initialize(TEST_EPICS, TEST_CONFIG)
    const goodState = await manager.read()
    // Simulate a crashed write: write a corrupt .tmp file without renaming
    const { writeFile } = await import('node:fs/promises')
    await writeFile(join(tempDir, '.state.yaml.tmp'), 'CORRUPTED PARTIAL CONTENT')
    // read() must return the intact state.yaml, not the tmp file
    const readState = await manager.read()
    expect(readState.run.status).toBe(goodState.run.status)
    expect(Object.keys(readState.epics)).toEqual(Object.keys(goodState.epics))
  })
})
```

### Project Structure Notes

**Files to CREATE:**
```
src/workspace/types.ts               # All state file types (StoryStatus, EpicStatus, StoryPhase, etc.)
src/workspace/state-manager.ts       # StateManager class with atomic write support
src/workspace/state-manager.test.ts  # Co-located tests
```

**Files to MODIFY:**
```
src/workspace/index.ts               # Add StateManager export and all type exports from types.ts
```

**Files NOT to touch:**
```
src/workspace/workspace-manager.ts       # Done in Story 2.2 — no changes
src/workspace/workspace-manager.test.ts  # Done in Story 2.2 — no changes
src/workspace/failure-notes.ts           # Story 4.1 — does not exist yet, do not create
src/config/                              # No changes
src/cli/                                 # No changes (Epic 3)
src/orchestrator/                        # No changes (Epic 3)
src/agents/                              # No changes (Epic 3)
src/errors/                              # No changes
src/cost/                                # No changes (Epic 5)
src/output/                              # No changes (Epic 5)
```

### Previous Story Intelligence (Story 2.2)

**Current state of `src/workspace/`:**
- `workspace-manager.ts` — exports `WorkspaceManager` class and `ArtifactValidationResult` interface
  - Constructor: `constructor(workspacePath: string)`
  - `readonly` properties: `workspacePath`, `artifactsPath`, `storiesPath`
  - Methods: `initialize()`, `ensureStoryDirectory(storyKey)`, `validateArtifacts(artifactsPath)`, `ingestArtifacts(artifactsPath)`
- `workspace-manager.test.ts` — 10 tests across two describe blocks using `beforeEach`/`afterEach`
- `index.ts` — barrel with `WorkspaceManager` and `ArtifactValidationResult` exports

**83 tests currently passing** (73 from Story 2.1, 10 added in Story 2.2) — verify no regressions.

**Established patterns to continue:**
- `node:` prefix for all Node.js built-in imports (`import { readFile } from 'node:fs/promises'`)
- `Promise.all` for parallel async operations where applicable
- No singletons — always constructor-injected paths
- Co-located test file: `state-manager.test.ts` in `src/workspace/`
- Use `mkdtemp` + `beforeEach`/`afterEach` for test isolation
- `moduleResolution: "bundler"` in tsconfig — relative imports within a module use `.js` extension: `from './types.js'`
- Barrel re-export pattern: named exports with `.js` extension
- Errors propagate naturally from fs operations — no additional wrapping in workspace module

**Key note from Story 2.2 dev notes:**
> `src/workspace/types.ts` — Story 2.3 — does not exist yet, do not create [in Story 2.2]
> `src/workspace/state-manager.ts` — Story 2.3 — does not exist yet, do not create [in Story 2.2]

Both these files are created in THIS story. They have been intentionally deferred here.

### Anti-Patterns to Avoid

- **DO NOT** read from `.state.yaml.tmp` in `read()` — always read from `state.yaml`
- **DO NOT** use `fs.writeFileSync` or `fs.renameSync` — all I/O must be async (`node:fs/promises`)
- **DO NOT** use `JSON.stringify/parse` — use the `yaml` package (`parse`, `stringify`) for state file I/O
- **DO NOT** import `yaml` as a default import — use named imports: `import { parse, stringify } from 'yaml'`
- **DO NOT** create `src/workspace/state.ts` or `src/workspace/state-types.ts` — the types file is `types.ts`
- **DO NOT** add `totalCost` computation logic to `read()` — store it directly as a field updated by `updateRun()`
- **DO NOT** throw `AgentError` — `StateManager` is in the `workspace` module, not the `errors` module. Throw plain `Error` for not-found cases.
- **DO NOT** import from `'../../config/...'` — `StateManager` takes a pre-built `ConfigSnapshot` via `initialize()` parameters; it never reads AppConfig directly
- **DO NOT** use `import type { ... } from 'yaml'` for `parse`/`stringify` — they are runtime values, not types
- **DO NOT** make `statePath` private — it should be `readonly` public so callers can reference it for display/logging

### References

- [Source: docs/planning-artifacts/architecture.md#State-File-Architecture] — Hierarchical schema by epic, run-level metadata as sibling, camelCase YAML fields, `totalCost` computed from stories
- [Source: docs/planning-artifacts/architecture.md#Gaps-Identified-and-Resolved — Gap 1] — "StateManager must use atomic writes to prevent state file corruption on unclean exit. Pattern: write to `.state.yaml.tmp`, then rename to `state.yaml`. Rename is atomic on POSIX filesystems."
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/workspace/state-manager.ts` (FR5), `src/workspace/types.ts` (state file types)
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — async/await only, `node:` prefix for builtins, function parameter DI, PascalCase types, camelCase YAML
- [Source: docs/planning-artifacts/architecture.md#Gaps-Identified-and-Resolved — Gap 4] — Phase enum values: `pending`, `storyCreation`, `development`, `codeReview`, `qa`, `completed`, `failed`
- [Source: docs/planning-artifacts/epics.md#Story-2.3] — Story requirements and all acceptance criteria
- [Source: docs/implementation-artifacts/2-2-bmad-artifact-validation-ingestion.md#Completion-Notes-List] — 83 tests currently passing; `node:` prefix convention; `beforeEach`/`afterEach` with `mkdtemp` pattern; workspace-manager.ts structure; `types.ts` and `state-manager.ts` intentionally deferred to Story 2.3

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/workspace/types.ts` with all 4 union types (`StoryStatus`, `EpicStatus`, `StoryPhase`, `RunStatus`) and 5 interfaces (`ConfigSnapshot`, `RunMeta`, `StoryState`, `EpicState`, `AppState`)
- Created `src/workspace/state-manager.ts` with `StateManager` class implementing constructor DI pattern, `initialize()`, `read()`, private `write()` (atomic via temp-file + rename), `updateStory()`, `updateRun()`, and `getStoriesByStatus()`
- Atomic write pattern implemented per NFR13: write to `.state.yaml.tmp` → `rename` to `state.yaml`. POSIX rename is atomic; `read()` always reads from `state.yaml` only.
- Updated `src/workspace/index.ts` to barrel-export `StateManager` and all 9 types
- Created `src/workspace/state-manager.test.ts` with 13 tests covering all ACs: initialization, read, update, filter by status, atomic write verification, and crash-safety contract
- All 96 tests pass (83 pre-existing + 13 new); no regressions
- Code review fixes applied: added `withLock()` mutex to `updateStory()`/`updateRun()` to prevent concurrent read-modify-write races; added structural validation in `read()` for corrupt-but-parseable YAML; added 4 new tests (cost field, ENOENT path, concurrent updates, invalid structure) — 100 total tests pass

### File List

- `src/workspace/types.ts` (created)
- `src/workspace/state-manager.ts` (created, updated in code review — mutex + read validation)
- `src/workspace/state-manager.test.ts` (created, updated in code review — 4 additional tests)
- `src/workspace/index.ts` (modified)
- `docs/implementation-artifacts/sprint-status.yaml` (modified — status updated)

## Change Log

- 2026-03-05: Story implemented — created StateManager with atomic writes, types module, and 13 tests; 96/96 tests pass (Date: 2026-03-05)
