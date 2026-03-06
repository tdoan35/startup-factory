# Story 4.1: Failure Notes Module

Status: done

## Story

As a system,
I want to write and read structured failure notes after each failed agent attempt,
So that subsequent retries have context about what went wrong and can try a different approach.

## Acceptance Criteria

1. **Given** an agent run fails **When** the failure notes module writes a failure note **Then** it creates a markdown file at `stories/{epic}-{story}/failures/attempt-{n}.md` **And** the file contains: error category, error message, model tier used, phase that failed, and any agent output before failure

2. **Given** a story is being retried **When** the agent is dispatched for the retry **Then** previous failure notes for that story are readable from the failures directory **And** the agent's context includes these failure notes so it can learn from previous attempts

3. **Given** multiple failure attempts for a story **When** reviewing the failures directory **Then** each attempt has its own numbered file (attempt-1.md, attempt-2.md, etc.) preserving the full failure history

## Tasks / Subtasks

- [x] Task 1: Implement FailureNotes module (AC: #1, #2, #3)
  - [x] 1.1: Create `src/workspace/failure-notes.ts` — export interface `FailureNoteData { errorCategory: string; errorMessage: string; modelTier: string; phase: string; agentOutput: string }`. Export async `writeFailureNote(workspacePath: string, storyKey: string, attemptNumber: number, data: FailureNoteData): Promise<string>`: builds path `join(workspacePath, 'stories', storyKey, 'failures', `attempt-${attemptNumber}.md`)`, calls `mkdir(dir, { recursive: true })`, writes markdown file with all fields formatted as headings/content (see Dev Notes for format), returns the file path written. Export async `readFailureNotes(workspacePath: string, storyKey: string): Promise<string[]>`: reads directory `join(workspacePath, 'stories', storyKey, 'failures')`, returns `[]` if directory does not exist (catch ENOENT), filters files matching `attempt-\d+\.md`, sorts by attempt number ascending, reads and returns each file's content as a string array.
  - [x] 1.2: Create `src/workspace/failure-notes.test.ts` — use `tmp` directory via `mkdtemp(join(tmpdir(), 'failure-notes-'))` for real filesystem I/O (no mocks needed). Tests for `writeFailureNote`: (a) creates file at correct path `stories/{storyKey}/failures/attempt-1.md`; (b) file content contains all 5 fields (errorCategory, errorMessage, modelTier, phase, agentOutput); (c) second write with attemptNumber=2 creates `attempt-2.md` without overwriting `attempt-1.md`; (d) creates parent directories if they don't exist (storyKey not pre-created); (e) returns the correct file path string. Tests for `readFailureNotes`: (f) returns `[]` when failures directory does not exist; (g) returns single note content when one file exists; (h) returns multiple notes sorted by attempt number ascending (write attempt-2 before attempt-1 to verify sort); (i) ignores files that don't match `attempt-N.md` pattern (e.g. `other.md`, `attempt-foo.md`).
  - [x] 1.3: Update `src/workspace/index.ts` — add `export { writeFailureNote, readFailureNotes } from './failure-notes.js'` and `export type { FailureNoteData } from './failure-notes.js'`

- [x] Task 2: Run tests and verify (AC: #1–#3)
  - [x] 2.1: Run `npm test` — confirm all 159 pre-existing tests plus new tests pass with no regressions. Report new test count and total.

## Dev Notes

### Architecture Placement

Per `docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure`:
- **New file:** `src/workspace/failure-notes.ts` — listed as `FR10-11: Write/read structured failure notes`
- **New file:** `src/workspace/failure-notes.test.ts` — co-located test file
- **Modify:** `src/workspace/index.ts` — add barrel exports

This module is part of the `workspace` module, alongside `state-manager.ts`, `workspace-manager.ts`, and `artifact-parser.ts`.

### Workspace Directory Structure (Already Exists)

From `src/workspace/workspace-manager.ts:ensureStoryDirectory()` (implemented in story 2.1):
```
.startup-factory/
  stories/
    {epic}-{story}/       <- created by ensureStoryDirectory()
      failures/           <- already created by ensureStoryDirectory()
        attempt-1.md      <- written by failure-notes.ts (this story)
        attempt-2.md
```

`ensureStoryDirectory()` calls `mkdir(join(storyDir, 'failures'), { recursive: true })` — so the `failures/` directory MAY already exist when `writeFailureNote` is called. The module must use `mkdir({ recursive: true })` to be idempotent regardless of whether the directory pre-exists.

### Failure Note File Format

Each `attempt-N.md` file should be formatted as human-readable markdown:

```markdown
# Failure Note: Attempt {N}

## Error Category
{errorCategory}

## Error Message
{errorMessage}

## Model Tier Used
{modelTier}

## Phase That Failed
{phase}

## Agent Output Before Failure
{agentOutput}
```

This format:
- Is readable by agents that consume the notes (FR11: agent learns from previous attempts)
- Is readable by humans debugging failures
- Contains all 5 required fields per AC #1

### Implementation

```typescript
// src/workspace/failure-notes.ts
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

export async function writeFailureNote(
  workspacePath: string,
  storyKey: string,
  attemptNumber: number,
  data: FailureNoteData,
): Promise<string> {
  const failuresDir = join(workspacePath, 'stories', storyKey, 'failures')
  await mkdir(failuresDir, { recursive: true })
  const filePath = join(failuresDir, `attempt-${attemptNumber}.md`)
  await writeFile(filePath, formatFailureNote(attemptNumber, data))
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
```

### Integration Context (How This Module Will Be Used in 4.2)

Story 4.2 (`three-tier-escalation-logic`) will call these functions when a pipeline phase fails. The escalation module will:
1. Call `writeFailureNote(workspacePath, storyKey, attemptNumber, { errorCategory, errorMessage, modelTier, phase, agentOutput })` after each failed agent run
2. Call `readFailureNotes(workspacePath, storyKey)` when building context for a retry agent dispatch

The `pipeline.ts` currently returns `'failed'` without writing failure notes. The escalation module (4.2) will intercept pipeline failures and call `writeFailureNote` before deciding to retry/escalate/flag.

This story only creates the module — it does NOT modify `pipeline.ts` or `dispatcher.ts`. Those integrations belong to 4.2 and 4.3.

### Test Strategy: Real Filesystem (No Mocks)

For this module, use **real filesystem I/O** with a temp directory. This is the correct approach because:
- The module is pure I/O — mocking `fs` provides no isolation benefit
- Real filesystem tests catch path construction bugs that mock tests miss
- Pattern established: `state-manager.test.ts` also uses real filesystem

```typescript
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'failure-notes-'))
})
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})
```

### Patterns From Previous Stories (Must Follow Exactly)

From story 3.4 and codebase inspection:
- **`node:` prefix** for all Node.js built-in imports (`node:fs/promises`, `node:path`, `node:os`)
- **`.js` extension** on relative imports within same module directory (`from './failure-notes.js'`)
- **`@/` aliases** for cross-module imports (not needed in this module itself)
- **`import type`** for type-only imports
- **`async/await`** everywhere — no `.then().catch()` chains
- **camelCase** function names, **PascalCase** interface names
- **kebab-case** file names
- **DO NOT** add anything to `src/agents/index.ts`
- **DO NOT** modify `pipeline.ts` or `dispatcher.ts` in this story

### State File Integration (Reference Only)

The architecture specifies a `failureNote` field in `StoryState` (from `src/workspace/types.ts`):
```typescript
export interface StoryState {
  // ...existing fields...
  failureNote?: string   // path to last failure note
}
```
This field already exists in `types.ts`. Story 4.2 will populate it via `stateManager.updateStory()` when writing failure notes. This story does NOT touch `state-manager.ts` or `types.ts`.

### Files NOT to Touch

- `src/orchestrator/pipeline.ts` — not modified in this story (4.2 handles escalation integration)
- `src/orchestrator/dispatcher.ts` — not modified in this story
- `src/workspace/state-manager.ts` — not modified
- `src/workspace/types.ts` — `failureNote` field already exists, no change needed
- `src/workspace/workspace-manager.ts` — not modified
- Any `src/agents/**` files
- `src/errors/**` files

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.1] — Exact AC text for all 3 ACs (FR10, FR11)
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `src/workspace/failure-notes.ts` confirmed file path
- [Source: docs/planning-artifacts/architecture.md#Workspace-Directory-Structure] — `stories/{epic}-{story}/failures/attempt-N.md` format
- [Source: docs/planning-artifacts/architecture.md#State-File-Architecture] — `failureNote: stories/1-2/failures/attempt-3.md` in schema example
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns] — kebab-case, async/await, `node:` prefix, `.js` extensions
- [Source: src/workspace/workspace-manager.ts:ensureStoryDirectory()] — already creates `failures/` directory with `mkdir({ recursive: true })`
- [Source: src/workspace/types.ts] — `failureNote?: string` field already in StoryState
- [Source: src/workspace/state-manager.test.ts] — real filesystem test pattern with mkdtemp/rm
- [Source: docs/implementation-artifacts/3-4-pipeline-dispatcher-build-command-structured-logging.md#Completion-Notes-List] — 159 tests passing; confirm no regressions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/workspace/failure-notes.ts` with `FailureNoteData` interface, `writeFailureNote` and `readFailureNotes` functions following project patterns (node: prefix, .js extensions, async/await, mkdtemp real filesystem tests).
- Created `src/workspace/failure-notes.test.ts` with 9 tests covering all specified scenarios: correct path creation, all 5 fields in output, multiple attempt files without overwrite, directory creation, return value, empty directory handling, sort order, and pattern filtering.
- Updated `src/workspace/index.ts` barrel exports to re-export both functions and the `FailureNoteData` type.
- All 168 tests pass (159 pre-existing + 9 new). Zero regressions.

### File List

- src/workspace/failure-notes.ts (new, modified by review)
- src/workspace/failure-notes.test.ts (new, modified by review)
- src/workspace/index.ts (modified)

## Change Log

- 2026-03-06: Implemented FailureNotes module — `writeFailureNote` and `readFailureNotes` with full test coverage (9 tests). Added barrel exports to workspace index. All ACs satisfied.
- 2026-03-06: Code review fixes — added overwrite protection (flag: 'wx'), storyKey path-traversal validation, attemptNumber range validation, explicit utf-8 encoding on writeFile, replaced dynamic test imports with top-level imports, added 3 new tests (171 total).
