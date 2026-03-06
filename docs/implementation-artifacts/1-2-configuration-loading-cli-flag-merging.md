# Story 1.2: Configuration Loading & CLI Flag Merging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want to define my preferences in a `startup-factory.yaml` config file and override them with CLI flags,
so that I can customize system behavior per-project and per-run.

## Acceptance Criteria

1. **Given** a `startup-factory.yaml` file exists in the project root with valid configuration, **When** the system loads configuration, **Then** it parses all config fields: `models.default`, `models.escalation`, `retry.maxAttempts`, `artifactsPath`, `workspacePath`, `cost.tracking`.

2. **Given** a config file sets `retry.maxAttempts: 3`, **When** the operator passes `--max-retries 5` as a CLI flag, **Then** the effective config uses `5` for max retries (CLI flag takes precedence).

3. **Given** no config file exists, **When** the system loads configuration, **Then** it uses sensible defaults for all config values without crashing.

4. **Given** a config file with invalid or missing fields, **When** the system loads configuration, **Then** it reports a clear validation error identifying the problematic fields.

## Tasks / Subtasks

- [x] Task 1: Define config types and schema (AC: #1, #4)
  - [x] 1.1: Create `src/config/types.ts` with `AppConfig`, `ModelsConfig`, `RetryConfig`, `CostConfig` types
  - [x] 1.2: Create `src/config/schema.ts` with default values, validation logic, and clear error messages for invalid fields
  - [x] 1.3: Define `DEFAULT_CONFIG` constant with sensible defaults for all fields
- [x] Task 2: Implement config file loading (AC: #1, #3, #4)
  - [x] 2.1: Create `src/config/config-loader.ts` with `loadConfig(configPath?: string): Promise<AppConfig>` function
  - [x] 2.2: Implement YAML file reading using `yaml` package (already installed) with `fs/promises`
  - [x] 2.3: Handle missing config file gracefully — return defaults without error
  - [x] 2.4: Implement validation that reports all invalid/unknown fields with clear messages
  - [x] 2.5: Merge file config over defaults (file values override defaults, missing file values fall back to defaults)
- [x] Task 3: Implement CLI flag merging (AC: #2)
  - [x] 3.1: Create `src/config/merge-cli-flags.ts` with function to overlay CLI options onto loaded config
  - [x] 3.2: CLI flags take highest precedence: CLI > config file > defaults
  - [x] 3.3: Only override config values for flags that were explicitly provided (not undefined)
- [x] Task 4: Wire config into CLI commands (AC: #1, #2)
  - [x] 4.1: Update `src/cli/build-command.ts` to add CLI options: `--max-retries <n>`, `--model <model>`, `--artifacts-path <path>`, `--workspace-path <path>`, `--config <path>`
  - [x] 4.2: Update `src/cli/retry-command.ts` to accept `--max-retries <n>`, `--model <model>`, `--config <path>`
  - [x] 4.3: In command actions, call `loadConfig()` then `mergeCliFlags()` to produce effective config
  - [x] 4.4: Use `@commander-js/extra-typings` for type-safe option parsing (per Story 1.1 dev notes)
- [x] Task 5: Update barrel exports (AC: all)
  - [x] 5.1: Update `src/config/index.ts` to export `loadConfig`, `mergeCliFlags`, `AppConfig`, `DEFAULT_CONFIG`, and validation functions
- [x] Task 6: Write tests (AC: #1, #2, #3, #4)
  - [x] 6.1: Create `src/config/config-loader.test.ts` — test loading valid YAML, missing file returns defaults, invalid fields produce clear errors
  - [x] 6.2: Create `src/config/schema.test.ts` — test validation logic, default values, type checking
  - [x] 6.3: Create `src/config/merge-cli-flags.test.ts` — test precedence (CLI > file > default), undefined flags don't override
  - [x] 6.4: Run `npm test` and verify all tests pass

## Dev Notes

### Architecture Requirements

- **Config boundary:** Config is loaded ONCE at startup and passed as a typed dependency to all consumers. No component reads config files directly — all receive typed `AppConfig` objects via function parameters.
- **Function parameter DI:** Pass config explicitly — no singletons, no module-level state, no DI framework.
- **YAML camelCase fields:** All YAML config fields use camelCase (`maxAttempts`, `defaultModel`) — matches TypeScript properties directly with no transformation layer needed.
- **`yaml` package:** Already installed (v2.x). Use `import { parse } from 'yaml'` for parsing. Types are included — no `@types/yaml` needed.
- **Config file name:** `startup-factory.yaml` in the project root (per PRD FR28).
- **Precedence order:** CLI flags > config file values > hardcoded defaults.

### Config Schema (from Architecture + PRD)

Based on FR28-FR31 and the architecture document's state file schema:

```typescript
interface AppConfig {
  models: {
    default: string        // e.g., 'claude-sonnet-4-6'
    escalation: string[]   // e.g., ['claude-sonnet-4-6', 'claude-opus-4-6']
  }
  retry: {
    maxAttempts: number    // default: 3
  }
  artifactsPath: string    // default: './planning-artifacts'
  workspacePath: string    // default: '.startup-factory'
  cost: {
    tracking: boolean      // default: true
  }
}
```

### Default Values

```typescript
const DEFAULT_CONFIG: AppConfig = {
  models: {
    default: 'claude-sonnet-4-6',
    escalation: ['claude-sonnet-4-6', 'claude-opus-4-6'],
  },
  retry: {
    maxAttempts: 3,
  },
  artifactsPath: './planning-artifacts',
  workspacePath: '.startup-factory',
  cost: {
    tracking: true,
  },
}
```

### CLI Flag Mapping

| CLI Flag | Config Path | Type |
|----------|------------|------|
| `--max-retries <n>` | `retry.maxAttempts` | number |
| `--model <model>` | `models.default` | string |
| `--artifacts-path <path>` | `artifactsPath` | string |
| `--workspace-path <path>` | `workspacePath` | string |
| `--config <path>` | (config file path override) | string |

### Commander.js Option Pattern

Story 1.1 dev notes indicate: "Use `@commander-js/extra-typings` when adding typed options in Story 1.2+". This story MUST switch build and retry commands to use `@commander-js/extra-typings` for type-safe option parsing:

```typescript
import { Command } from '@commander-js/extra-typings'

export function registerBuildCommand(program: Command): void {
  program
    .command('build <artifact-path>')
    .description('Run the full build pipeline')
    .option('--max-retries <n>', 'Maximum retry attempts', parseInt)
    .option('--model <model>', 'Default model to use')
    .option('--workspace-path <path>', 'Workspace directory path')
    .option('--config <path>', 'Path to config file')
    .action(async (artifactPath, options) => {
      // options is fully typed from the chained .option() calls
      const config = await loadConfig(options.config)
      const effective = mergeCliFlags(config, {
        maxRetries: options.maxRetries,
        model: options.model,
        workspacePath: options.workspacePath,
        artifactsPath: artifactPath,  // positional arg maps to config
      })
      console.log('Build command not yet implemented — config loaded:', effective)
    })
}
```

**IMPORTANT:** When switching to `@commander-js/extra-typings`, import `Command` from `'@commander-js/extra-typings'` instead of `'commander'`. Both packages are already installed. The main `src/index.ts` should also switch its import. This is required for the type inference on `.opts()` to work correctly.

### YAML Parsing Pattern

```typescript
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'

async function loadConfigFile(configPath: string): Promise<Partial<RawConfig>> {
  const content = await readFile(configPath, 'utf-8')
  return parse(content) ?? {}
}
```

Use `node:fs/promises` (with `node:` prefix for clarity). Handle `ENOENT` error code for missing files — return empty object to fall through to defaults.

### Validation Pattern

Validation should check:
- `models.default` is a non-empty string
- `models.escalation` is an array of non-empty strings
- `retry.maxAttempts` is a positive integer
- `artifactsPath` is a non-empty string
- `workspacePath` is a non-empty string
- `cost.tracking` is a boolean
- No unknown top-level keys (warn about typos)

Return ALL validation errors at once, not just the first one. Format: `"Invalid config: retry.maxAttempts must be a positive integer (got: -1), models.default must be a non-empty string (got: '')"`.

**Do NOT throw raw `Error` — use a typed error.** Story 1.3 will create the full error type system. For now, create a minimal `ConfigError extends Error` in `src/config/config-loader.ts` or `src/config/schema.ts`. This is a temporary placeholder until Story 1.3 establishes the canonical error types.

### Previous Story Intelligence

**From Story 1.1 (Project Scaffold) — Key Learnings:**

- **moduleResolution is `bundler`** (NOT `NodeNext`) — was changed during code review because `NodeNext` is incompatible with `@/` path aliases. The `tsconfig.json` uses `"moduleResolution": "bundler"`.
- **All 8 module directories exist** with empty barrel `index.ts` files (`export {}`)
- **CLI commands follow the register pattern:** `registerXxxCommand(program: Command): void`
- **Tests are co-located:** `build-command.test.ts` next to `build-command.ts`
- **8 tests currently passing** across 4 CLI command test files
- **Import pattern established:** `import { Command } from 'commander'` — this story updates to `@commander-js/extra-typings`
- **Barrel re-export pattern:** `src/cli/index.ts` uses `export { registerBuildCommand } from './build-command.js'`

**File extensions in imports:** The existing code uses `.js` extension in relative imports (e.g., `'./build-command.js'`). This is required for ES modules with bundler resolution. **MUST maintain this pattern** in all new files.

### Project Structure Notes

Files to CREATE:
```
src/config/types.ts          # AppConfig, ModelsConfig, RetryConfig, CostConfig
src/config/schema.ts         # DEFAULT_CONFIG, validateConfig()
src/config/config-loader.ts  # loadConfig()
src/config/merge-cli-flags.ts # mergeCliFlags()
src/config/config-loader.test.ts
src/config/schema.test.ts
src/config/merge-cli-flags.test.ts
```

Files to MODIFY:
```
src/config/index.ts          # Update barrel exports (currently empty)
src/cli/build-command.ts     # Add CLI options, load config in action
src/cli/retry-command.ts     # Add CLI options, load config in action
src/cli/build-command.test.ts  # May need updates for new import
src/index.ts                 # Switch import from 'commander' to '@commander-js/extra-typings'
```

Files to NOT touch:
```
src/cli/status-command.ts    # No config options needed yet
src/cli/cost-command.ts      # No config options needed yet
src/errors/                  # Story 1.3 handles this
src/orchestrator/            # Epic 3
src/agents/                  # Epic 3
src/workspace/               # Epic 2
src/cost/                    # Epic 5
src/output/                  # Epic 3
```

### Anti-Patterns to Avoid

- **DO NOT** create a singleton config instance or module-level `let config` variable
- **DO NOT** use `js-yaml` package — use the `yaml` package that's already installed
- **DO NOT** use `require()` or `JSON.parse(fs.readFileSync(...))` — use async `readFile` + `parse`
- **DO NOT** use `IAppConfig` or `TAppConfig` — no prefixes on types
- **DO NOT** use `.then().catch()` — use `async/await` with `try/catch`
- **DO NOT** use `../../errors/...` imports — use `@/errors/...` when needed (but Story 1.3 isn't done yet, so keep error types local for now)
- **DO NOT** validate by throwing on first error — collect ALL errors and report together
- **DO NOT** silently ignore invalid config — always report validation errors clearly

### Testing Approach

Use Vitest with temporary directories for config file tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

describe('loadConfig', () => {
  const tmpDir = join(import.meta.dirname, '__tmp__')

  beforeEach(async () => { await mkdir(tmpDir, { recursive: true }) })
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }) })

  it('returns defaults when no config file exists', async () => {
    const config = await loadConfig(join(tmpDir, 'nonexistent.yaml'))
    expect(config).toEqual(DEFAULT_CONFIG)
  })
})
```

**Note:** `import.meta.dirname` is available in Node.js 20+ as a direct replacement for `__dirname` in ES modules.

### References

- [Source: docs/planning-artifacts/architecture.md#Config-→-Everything-Boundary] — Config loaded once, passed as dependency
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — Naming conventions, async patterns, DI
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — config-loader.ts, schema.ts, types.ts locations
- [Source: docs/planning-artifacts/architecture.md#Core-Architectural-Decisions] — State file schema showing config snapshot in run metadata
- [Source: docs/planning-artifacts/epics.md#Story-1.2] — Story requirements and acceptance criteria
- [Source: docs/planning-artifacts/prd.md] — FR28 (YAML config), FR29 (CLI flag override), FR30 (model/escalation config), FR31 (max retry config)
- [Source: docs/implementation-artifacts/1-1-project-scaffold-cli-entry-point.md] — Previous story patterns, moduleResolution fix, barrel exports, test patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation completed cleanly.

### Completion Notes List

- Implemented `AppConfig` type hierarchy in `src/config/types.ts`
- `DEFAULT_CONFIG` and `validateConfig()` in `src/config/schema.ts` — validation collects ALL errors at once, reports unknown top-level keys
- `loadConfig()` in `src/config/config-loader.ts` — handles missing file (returns defaults), validates YAML content, merges file values over defaults. Uses a local `ConfigError extends Error` as placeholder until Story 1.3 establishes canonical error types
- `mergeCliFlags()` in `src/config/merge-cli-flags.ts` — CLI > file > defaults precedence, `undefined` flags do not override, original config not mutated
- Switched all CLI commands and `src/index.ts` from `'commander'` to `'@commander-js/extra-typings'` for type-safe option inference. This required updating status-command.ts and cost-command.ts imports as well (otherwise TypeScript type incompatibility with the main program)
- All 41 tests pass; TypeScript typecheck passes with zero errors
- 33 new tests added across 3 new test files; 8 existing tests preserved with no regressions

### File List

**Created:**
- `src/config/types.ts`
- `src/config/schema.ts`
- `src/config/config-loader.ts`
- `src/config/merge-cli-flags.ts`
- `src/config/config-loader.test.ts`
- `src/config/schema.test.ts`
- `src/config/merge-cli-flags.test.ts`

**Modified:**
- `src/config/index.ts` — barrel exports
- `src/cli/build-command.ts` — added CLI options, config loading, extra-typings import
- `src/cli/retry-command.ts` — added CLI options, config loading, extra-typings import
- `src/cli/status-command.ts` — import switch to `@commander-js/extra-typings` (required for type compatibility)
- `src/cli/cost-command.ts` — import switch to `@commander-js/extra-typings` (required for type compatibility)
- `src/cli/build-command.test.ts` — import switch; rewritten with option registration + mocked action tests
- `src/cli/retry-command.test.ts` — import switch; rewritten with option registration + mocked action tests
- `src/cli/status-command.test.ts` — import switch
- `src/cli/cost-command.test.ts` — import switch
- `src/index.ts` — import switch to `@commander-js/extra-typings`
- `docs/implementation-artifacts/sprint-status.yaml` — status updated to `review`

## Change Log

- 2026-03-05: Story implemented by claude-sonnet-4-6. Config loading, YAML parsing, CLI flag merging, barrel exports, and all tests added. All CLI commands switched to @commander-js/extra-typings. 41 tests passing, typecheck clean.
- 2026-03-05: Code review by claude-sonnet-4-6. Fixed 7 issues: (H1) CLI flags now validated in mergeCliFlags — throws ConfigError for invalid maxRetries (NaN, negative, zero, non-integer); (H2) CLI command tests rewritten to verify option registration and action behavior using vi.mock/vi.hoisted; (M1) --artifacts-path option added to build-command, takes precedence over positional arg; (M2) models.escalation array cloned in mergeWithDefaults (was assigned by reference); (L1) duplicate imports merged in build/retry commands; (L2) parseInt given explicit radix 10; (L3) env-dependent test fixed with process.chdir to tmpDir. 56 tests passing.
