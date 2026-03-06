# Story 3.2: Story Creator & Developer Agent Configurations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want configured Story Creator and Developer agents with role-specific prompts and tool permissions,
So that stories can be generated from BMAD artifacts and then implemented as working code.

## Acceptance Criteria

1. **Given** the Story Creator agent configuration, **When** the agent is dispatched with BMAD planning artifacts, **Then** it has read-only access to the workspace artifacts directory (tools: Read, Glob, Grep) **And** it has write access to create story spec files (tool: Write) **And** its system prompt instructs it to consume PRD, architecture, epics, and UX specs to produce implementation-ready story specs with clear acceptance criteria.

2. **Given** the Developer agent configuration, **When** the agent is dispatched with a story spec, **Then** it has read access to the workspace — story specs, BMAD artifacts, and existing source code (tools: Read, Glob, Grep) **And** it has write access to the project source code directory (tools: Write, Edit) **And** it has Bash access for running build and test commands (tool: Bash) **And** its system prompt instructs it to implement the story, write functional code and corresponding tests, and follow the architecture conventions.

3. **Given** either agent's configuration, **When** inspecting the config.ts file, **Then** it specifies the model tier, tool permissions, and retry settings as a typed `AgentRoleConfig` TypeScript object **And** the system prompt is stored as a separate `prompt.md` file with `promptPath` in the config pointing to it.

## Tasks / Subtasks

- [x] Task 1: Add `AgentRoleConfig` type to `src/agents/types.ts` and update barrel exports (AC: #3)
  - [x] 1.1: Add `AgentRoleConfig` interface to `src/agents/types.ts`: `{ model: string; allowedTools: string[]; maxRetries: number; promptPath: string }`
  - [x] 1.2: Export `AgentRoleConfig` from `src/agents/index.ts` barrel file

- [x] Task 2: Create Story Creator agent configuration (AC: #1, #3)
  - [x] 2.1: Create `src/agents/story-creator/config.ts` — export `storyCreatorConfig: AgentRoleConfig` with `model: 'claude-sonnet-4-6'`, `allowedTools: ['Read', 'Glob', 'Grep', 'Write']`, `maxRetries: 3`, `promptPath` resolved from `import.meta.url`
  - [x] 2.2: Create `src/agents/story-creator/prompt.md` — complete system prompt instructing agent to consume BMAD artifacts and produce implementation-ready story specs with clear BDD acceptance criteria

- [x] Task 3: Create Developer agent configuration (AC: #2, #3)
  - [x] 3.1: Create `src/agents/developer/config.ts` — export `developerConfig: AgentRoleConfig` with `model: 'claude-sonnet-4-6'`, `allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']`, `maxRetries: 3`, `promptPath` resolved from `import.meta.url`
  - [x] 3.2: Create `src/agents/developer/prompt.md` — complete system prompt instructing agent to implement story, write functional code and tests, and follow architecture conventions

- [x] Task 4: Write co-located tests for agent configurations (AC: #1, #2, #3)
  - [x] 4.1: Create `src/agents/story-creator/config.test.ts` — verify model, allowedTools (contains Read/Glob/Grep/Write, does NOT contain Bash or Edit), maxRetries, and promptPath points to existing .md file
  - [x] 4.2: Create `src/agents/developer/config.test.ts` — verify model, allowedTools (all 6 tools including Bash and Edit), maxRetries, and promptPath points to existing .md file
  - [x] 4.3: Run `npm test` to confirm all 110 pre-existing tests pass plus new tests (no regressions)

## Dev Notes

### Architecture Requirements

**New files to CREATE:**
```
src/agents/story-creator/config.ts        # Story Creator AgentRoleConfig object
src/agents/story-creator/prompt.md        # Story Creator system prompt (loaded at runtime)
src/agents/story-creator/config.test.ts   # Config shape + file existence tests
src/agents/developer/config.ts            # Developer AgentRoleConfig object
src/agents/developer/prompt.md            # Developer system prompt (loaded at runtime)
src/agents/developer/config.test.ts       # Config shape + file existence tests
```

**Files to MODIFY:**
```
src/agents/types.ts     # Add AgentRoleConfig interface alongside existing types
src/agents/index.ts     # Add AgentRoleConfig to barrel exports
```

**Files NOT to touch:**
- `src/agents/agent-runner.ts`, `src/agents/claude-agent-runner.ts`, `src/agents/claude-agent-runner.test.ts`, `src/agents/agent-runner.test.ts` — Story 3.1, already done
- `src/agents/code-reviewer/`, `src/agents/qa/` — Story 3.3 territory
- `src/orchestrator/` — Story 3.4 territory
- Any file outside `src/agents/` — out of scope

### AgentRoleConfig Type

Add to `src/agents/types.ts` (after existing types, before the end of file):

```typescript
export interface AgentRoleConfig {
  model: string          // e.g., 'claude-sonnet-4-6' or 'claude-opus-4-6'
  allowedTools: string[] // Tools auto-approved for this agent role (no permission prompts)
  maxRetries: number     // Max retry attempts before escalation kicks in
  promptPath: string     // Absolute path to the system prompt .md file (loaded at runtime)
}
```

**Where it fits:** `AgentRoleConfig` describes a static agent role definition. `AgentConfig` (also in types.ts) is the runtime config for a single dispatch — built from `AgentRoleConfig` + runtime context (workspacePath, prompt, loaded systemPrompt). They are complementary.

### Config.ts Pattern — ESM `__dirname` Equivalent

The project uses `"type": "module"` in package.json. Node.js ESM modules do NOT have `__dirname` or `__filename` globals. Use the standard ESM pattern:

```typescript
// src/agents/story-creator/config.ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const storyCreatorConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
```

```typescript
// src/agents/developer/config.ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { AgentRoleConfig } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const developerConfig: AgentRoleConfig = {
  model: 'claude-sonnet-4-6',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  maxRetries: 3,
  promptPath: join(__dirname, 'prompt.md'),
}
```

### Tool Permissions Rationale

**Story Creator (`allowedTools: ['Read', 'Glob', 'Grep', 'Write']`):**
- `Read` — reads BMAD planning artifacts from `.startup-factory/artifacts/`
- `Glob` — discovers files in the artifacts directory
- `Grep` — searches artifact content for relevant sections and story details
- `Write` — creates the story spec file at `stories/{epic}-{story}/spec.md`
- **Excluded `Edit`** — no existing files need modification (spec is always new)
- **Excluded `Bash`** — no build or test commands needed for story spec creation

**Developer (`allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']`):**
- `Read` — reads story spec, BMAD artifacts, and existing source code for context
- `Glob` — discovers files in workspace and project source tree
- `Grep` — searches codebase for existing patterns and implementations
- `Write` — creates new source files and test files
- `Edit` — modifies existing source files during implementation and refactoring
- `Bash` — runs `npm test`, `npm run typecheck`, `npm run build`
- **All 6 tools included** — developer needs full access to implement, test, and validate

### promptPath and Runtime Loading

`promptPath` resolves to an absolute path at module initialization time. The orchestrator (Story 3.4) will load it when building the `AgentConfig`:

```typescript
// Future orchestrator usage (Story 3.4 territory — do NOT implement here):
const systemPrompt = await fs.readFile(config.promptPath, 'utf-8')
const agentConfig: AgentConfig = {
  model: roleConfig.model,
  systemPrompt,
  allowedTools: roleConfig.allowedTools,
  workspacePath,
  prompt: taskPrompt,
}
```

Story 3.2 only creates the config and prompt files. The loading logic is Story 3.4 territory.

### System Prompt Content Requirements

**`src/agents/story-creator/prompt.md` MUST include:**
1. Agent role and purpose statement
2. Workspace file locations: artifacts at `.startup-factory/artifacts/`, write spec to `.startup-factory/stories/{epic}-{story}/spec.md`
3. Input description: which BMAD artifacts to read (PRD, architecture doc, epics/stories, optional UX)
4. Required spec.md format: Story (As a/I want/So that), Acceptance Criteria (Given/When/Then BDD format), Tasks/Subtasks (ordered and concrete), Dev Notes (architecture patterns, files to touch, testing requirements)
5. Quality standards: every AC must be testable, tasks must be concrete (not vague), reference architecture doc, no inventing requirements

**`src/agents/developer/prompt.md` MUST include:**
1. Agent role and purpose statement
2. Workspace file locations: story spec at `.startup-factory/stories/{epic}-{story}/spec.md`, BMAD artifacts in `.startup-factory/artifacts/`, write code to project source directory
3. Red-green-refactor workflow: write failing tests first → implement minimal code → refactor
4. Architectural conventions to follow (extracted from architecture.md):
   - TypeScript strict mode, ES modules, `"type": "module"`
   - File naming: kebab-case; Types: PascalCase no prefix; Constants: UPPER_SNAKE_CASE
   - `async/await` everywhere — no callbacks or `.then()` chains
   - Co-located tests: `foo.ts` → `foo.test.ts` in same directory
   - Cross-module imports: `@/` aliases with `.js` extension
   - Within-module imports: relative with `.js` extension
   - `node:` prefix for all Node.js built-ins
   - Dependency injection via function parameters — no DI framework
5. Quality standards: tests before marking complete, run `npm test` and `npm run typecheck`, no regressions, no scope creep beyond story spec

### Testing Pattern

```typescript
// src/agents/story-creator/config.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { storyCreatorConfig } from './config.js'

describe('storyCreatorConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(storyCreatorConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes Read, Glob, Grep, Write in allowedTools', () => {
    expect(storyCreatorConfig.allowedTools).toContain('Read')
    expect(storyCreatorConfig.allowedTools).toContain('Glob')
    expect(storyCreatorConfig.allowedTools).toContain('Grep')
    expect(storyCreatorConfig.allowedTools).toContain('Write')
  })

  it('does NOT include Bash in allowedTools (read-only + write spec only)', () => {
    expect(storyCreatorConfig.allowedTools).not.toContain('Bash')
  })

  it('does NOT include Edit in allowedTools (spec is always a new file)', () => {
    expect(storyCreatorConfig.allowedTools).not.toContain('Edit')
  })

  it('has maxRetries of 3', () => {
    expect(storyCreatorConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(storyCreatorConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(storyCreatorConfig.promptPath)).toBe(true)
  })
})
```

```typescript
// src/agents/developer/config.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { developerConfig } from './config.js'

describe('developerConfig', () => {
  it('specifies claude-sonnet-4-6 as the model', () => {
    expect(developerConfig.model).toBe('claude-sonnet-4-6')
  })

  it('includes all 6 tools in allowedTools', () => {
    const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    for (const tool of tools) {
      expect(developerConfig.allowedTools).toContain(tool)
    }
  })

  it('has maxRetries of 3', () => {
    expect(developerConfig.maxRetries).toBe(3)
  })

  it('has a promptPath ending in prompt.md that exists on disk', () => {
    expect(developerConfig.promptPath).toMatch(/prompt\.md$/)
    expect(existsSync(developerConfig.promptPath)).toBe(true)
  })
})
```

### Project Structure Notes

- `src/agents/story-creator/` and `src/agents/developer/` are new subdirectories — no `index.ts` barrel needed (they are not public module APIs; the orchestrator will import from them directly)
- `AgentRoleConfig` belongs in `src/agents/types.ts` alongside the other agent types
- The `src/agents/index.ts` barrel currently exports `AgentRunner`, `ClaudeAgentRunner`, `AgentConfig`, `AgentResult`, `AgentCostData` — add `AgentRoleConfig` to it
- Do NOT add `storyCreatorConfig` or `developerConfig` to the barrel — they are consumed by orchestrator which imports from the subdirectory directly

### Previous Story Intelligence (Story 3.1)

**110 tests currently passing** (13 test files, 110 tests) — verify no regressions after all changes.

**Established patterns to continue:**
- `node:` prefix for all Node.js built-in imports: `node:url`, `node:path`, `node:fs`
- Relative imports within a module use `.js` extension: `from '../types.js'`
- Cross-module imports use `@/` alias: never needed in this story (agent configs only import from `../types.js`)
- PascalCase types, camelCase variables, no `I` prefix on interfaces (`AgentRoleConfig` not `IAgentRoleConfig`)
- `async/await` — no callbacks (no async needed in config.ts itself, but keep in mind for prompt loading)
- Constructor-injected dependencies — not applicable here (plain objects)
- `moduleResolution: "bundler"` in tsconfig means `.js` extensions are required in relative imports

**Current state of `src/agents/index.ts`:**
```typescript
export type { AgentRunner } from './agent-runner.js'
export { ClaudeAgentRunner } from './claude-agent-runner.js'
export type { AgentConfig, AgentResult, AgentCostData } from './types.js'
```
Add `AgentRoleConfig` to the `types.js` re-export line.

**Current state of `src/agents/types.ts`:**
Contains `AgentConfig`, `AgentCostData`, `AgentResult`. Add `AgentRoleConfig` after these.

### Anti-Patterns to Avoid

- **DO NOT** use `__dirname` directly — ESM modules don't have it; use `dirname(fileURLToPath(import.meta.url))`
- **DO NOT** inline the system prompt as a string in config.ts — architecture requires separate `prompt.md`
- **DO NOT** add `index.ts` barrels to `story-creator/` or `developer/` — they're internal agent directories
- **DO NOT** import from `@/orchestrator/`, `@/workspace/`, or any other module — agent configs should only import from `../types.js` and Node.js built-ins
- **DO NOT** add `Edit` or `Bash` to Story Creator's allowedTools — it reads artifacts and writes one new spec file only
- **DO NOT** set `promptPath` to a relative path string — always resolve to absolute using `join(__dirname, 'prompt.md')`
- **DO NOT** add `storyCreatorConfig` or `developerConfig` to `src/agents/index.ts` barrel — only `AgentRoleConfig` type goes there
- **DO NOT** write placeholder prompt.md files — both prompts must be complete and actionable; tests verify file existence
- **DO NOT** use `import type` for `AgentRoleConfig` in `src/agents/index.ts` barrel re-export — use `export type { AgentRoleConfig }` (it's a type, already a type export)

### References

- [Source: docs/planning-artifacts/architecture.md#Agent-Configuration-Pattern] — "Hybrid: structural config in TypeScript (config.ts) and system prompts as external markdown (prompt.md)"; layout shows `story-creator/config.ts`, `story-creator/prompt.md`, `developer/config.ts`, `developer/prompt.md`
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — Confirmed paths: `src/agents/story-creator/config.ts`, `src/agents/story-creator/prompt.md`, `src/agents/developer/config.ts`, `src/agents/developer/prompt.md`
- [Source: docs/planning-artifacts/architecture.md#Orchestrator-Agents-Boundary] — Orchestrator calls `AgentRunner.run()` with `AgentConfig`; agent role configs inform how orchestrator builds `AgentConfig` at dispatch time
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — kebab-case files, PascalCase types no prefix, `node:` prefix, `async/await`, `@/` aliases, `.js` extensions
- [Source: docs/planning-artifacts/epics.md#Story-3.2] — Exact AC text: Story Creator (read-only artifacts + write spec + system prompt content), Developer (read workspace + write source + Bash + system prompt content), config.ts inspection requirements
- [Source: docs/planning-artifacts/architecture.md#Error-Handling-&-Logging] — `ErrorCategory` enum: Transient, Capability, Specification, System — referenced for completeness; no error handling needed in config.ts itself
- [Source: docs/implementation-artifacts/3-1-agentrunner-interface-claude-agent-runner-implementation.md#Completion-Notes-List] — 110 tests passing; `node:` prefix; co-located tests; `.js` extension for relative imports; ESM module conventions
- [Source: src/agents/types.ts] — Current file contents; `AgentRoleConfig` goes here after `AgentResult`
- [Source: src/agents/index.ts] — Current barrel contents; add `AgentRoleConfig` to existing `types.js` re-export

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Added `AgentRoleConfig` interface to `src/agents/types.ts` after `AgentResult` with fields: `model`, `allowedTools`, `maxRetries`, `promptPath`
- Exported `AgentRoleConfig` from `src/agents/index.ts` barrel via `export type` on the existing `types.js` re-export line
- Created `src/agents/story-creator/config.ts` using ESM `import.meta.url` pattern for `__dirname` — `promptPath` resolves to absolute path at module init time
- Created `src/agents/story-creator/prompt.md` — complete actionable system prompt covering role, workspace locations, inputs to read, required spec.md format with BDD ACs, quality standards
- Created `src/agents/developer/config.ts` with all 6 tools including Bash and Edit
- Created `src/agents/developer/prompt.md` — complete actionable system prompt covering red-green-refactor workflow, ESM conventions, architectural rules, and completion criteria
- 10 new tests added (6 for story-creator, 4 for developer); all 120 tests pass (110 pre-existing + 10 new)
- Pre-existing typecheck error in `src/agents/claude-agent-runner.test.ts:34` (Story 3.1 territory, not to be touched) — `input_tokens` vs `inputTokens` in `ModelUsage` type from Anthropic SDK version change; not caused by this story

### File List

- `src/agents/types.ts` (modified — added `AgentRoleConfig` interface)
- `src/agents/index.ts` (modified — added `AgentRoleConfig` to barrel re-export)
- `src/agents/story-creator/config.ts` (created)
- `src/agents/story-creator/prompt.md` (created)
- `src/agents/story-creator/config.test.ts` (created)
- `src/agents/developer/config.ts` (created)
- `src/agents/developer/prompt.md` (created)
- `src/agents/developer/config.test.ts` (created)

## Change Log

- 2026-03-05: Added `AgentRoleConfig` type and Story Creator + Developer agent configurations with co-located tests. 120 tests passing (10 new).
- 2026-03-05: Code review fixes — 4 issues resolved: (1) tsup.config.ts updated with `onSuccess` hook to copy all `.md` files from `src/` to `dist/` (prompt.md files now included in build output); (2) pre-existing typecheck error in `claude-agent-runner.test.ts:34` fixed (input_tokens→inputTokens, added missing ModelUsage fields); (3) `toHaveLength` assertions added to both config test files to enforce exact tool counts; (4) hardcoded `.startup-factory/` paths in both prompt.md files replaced with `{{workspacePath}}` placeholder for Story 3.4 orchestrator substitution. 122 tests passing, typecheck clean.
