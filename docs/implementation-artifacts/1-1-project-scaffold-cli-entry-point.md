# Story 1.1: Project Scaffold & CLI Entry Point

Status: done

## Story

As an operator,
I want to install startup-factory and run it with `--help`,
so that I can verify the tool is installed and see available commands.

## Acceptance Criteria

1. **Given** the project is cloned and dependencies are installed, **When** the operator runs `startup-factory --help`, **Then** the CLI displays usage information with the 4 available commands (build, retry, status, cost) **And** each command stub exists and prints a placeholder message when invoked.

2. **Given** the project source code, **When** a developer inspects the project structure, **Then** the module directories exist (cli, orchestrator, agents, workspace, cost, output, config, errors) with barrel `index.ts` files **And** TypeScript strict mode is enabled with ES modules and `@/` path aliases configured **And** tsup is configured to bundle to a distributable CLI binary **And** Vitest is configured and a sample test passes.

3. **Given** the project dependencies, **When** reviewing `package.json`, **Then** Commander.js v14, `@anthropic-ai/claude-agent-sdk`, `yaml`, TypeScript 5.x, `@types/node`, `vitest`, `tsup`, and `@commander-js/extra-typings` are installed.

## Tasks / Subtasks

- [x] Task 1: Initialize project and install dependencies (AC: #3)
  - [x] 1.1: Run `npm init -y`, set `"type": "module"` in package.json, set name to `startup-factory`
  - [x] 1.2: Install production deps: `commander@14 @anthropic-ai/claude-agent-sdk yaml`
  - [x] 1.3: Install dev deps: `typescript@5 @types/node vitest tsup @commander-js/extra-typings tsx`
  - [x] 1.4: Add bin entry to package.json: `"bin": { "startup-factory": "./dist/index.js" }`
  - [x] 1.5: Add scripts: `"build": "tsup"`, `"dev": "tsx src/index.ts"`, `"test": "vitest run"`, `"test:watch": "vitest"`
- [x] Task 2: Configure TypeScript, build, and test tooling (AC: #2)
  - [x] 2.1: Create `tsconfig.json` with strict mode, ES2022 target, ESNext module, NodeNext moduleResolution, `@/*` path alias mapping to `src/*`, outDir `dist`, include `src`
  - [x] 2.2: Create `tsup.config.ts` — entry `src/index.ts`, format `esm`, target `node20`, dts false, shims true, banner with `#!/usr/bin/env node` for CLI binary
  - [x] 2.3: Create `vitest.config.ts` — resolve alias `@/` to `src/`, test include `src/**/*.test.ts`
  - [x] 2.4: Create `.gitignore` with `node_modules/`, `dist/`, `.env`, `*.tmp`, `.startup-factory/`
  - [x] 2.5: Create `.env.example` with `ANTHROPIC_API_KEY=your-key-here`
- [x] Task 3: Create module directory structure with barrel files (AC: #2)
  - [x] 3.1: Create 8 module dirs under `src/`: `cli/`, `orchestrator/`, `agents/`, `workspace/`, `cost/`, `output/`, `config/`, `errors/`
  - [x] 3.2: Create `index.ts` barrel file in each module dir (empty export for now: `export {}`)
- [x] Task 4: Implement CLI entry point with Commander.js (AC: #1)
  - [x] 4.1: Create `src/index.ts` — import Commander, create program with name `startup-factory`, version `0.1.0`, description
  - [x] 4.2: Create `src/cli/build-command.ts` — export function that registers `build <artifact-path>` command with placeholder action printing `"Build command not yet implemented"`
  - [x] 4.3: Create `src/cli/retry-command.ts` — export function that registers `retry <story-id>` command with placeholder action
  - [x] 4.4: Create `src/cli/status-command.ts` — export function that registers `status` command with placeholder action
  - [x] 4.5: Create `src/cli/cost-command.ts` — export function that registers `cost` command with placeholder action
  - [x] 4.6: Update `src/cli/index.ts` barrel to re-export all command registration functions
  - [x] 4.7: Wire all commands in `src/index.ts` and call `program.parse()`
- [x] Task 5: Create sample test and verify tooling (AC: #2)
  - [x] 5.1: Create `src/cli/build-command.test.ts` — test that build command can be registered on a Commander program without error
  - [x] 5.2: Run `npm test` and verify the sample test passes
  - [x] 5.3: Run `npm run build` and verify tsup produces `dist/index.js` with shebang
  - [x] 5.4: Verify `node dist/index.js --help` shows all 4 commands

## Dev Notes

### Architecture Requirements

- **Custom minimal scaffold** — no starter template. Hand-picked dependencies only.
- **TypeScript 5.x strict mode** on **Node.js 20+** with **ES modules** (`"type": "module"`)
- **Commander.js v14** with `@commander-js/extra-typings` for type-safe CLI argument parsing
- **@commander-js/extra-typings** installed for future type-safe option parsing — for this story, import from `'commander'` directly since commands only have simple positional args. Use `@commander-js/extra-typings` when adding typed options in Story 1.2+
- **@anthropic-ai/claude-agent-sdk** installed now but not used until Epic 3
- **yaml** package installed now but not used until Epic 1 Story 2 (config loading)
- **tsup** for bundling — single entry point, tree-shaken ESM output, shebang banner for CLI binary
- **Vitest** for testing — TypeScript-native, fast, compatible with Node.js patterns
- **tsx** for dev-time execution without compile step

### Code Organization (8 Modules)

```
src/
  index.ts           # Main entry — Commander program setup, wire commands, parse
  cli/               # Commander command definitions (build, retry, status, cost)
  orchestrator/      # Dispatch logic, state machine (Epic 3+)
  agents/            # Agent configurations, prompts (Epic 3+)
  workspace/         # Workspace and state file management (Epic 2+)
  cost/              # Cost tracking and reporting (Epic 5)
  output/            # Terminal output formatting, structured logging (Epic 3+)
  config/            # Config loading and CLI flag merging (Story 1.2)
  errors/            # Error types and classification (Story 1.3)
```

### Naming Conventions (MUST FOLLOW)

| Category | Convention | Example |
|----------|-----------|---------|
| Source files | kebab-case | `build-command.ts`, `state-manager.ts` |
| Test files | co-located `.test.ts` | `build-command.test.ts` |
| Functions/variables | camelCase | `registerBuildCommand` |
| Types/interfaces | PascalCase, NO prefix | `AgentConfig` (never `IAgentConfig`) |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Enums | PascalCase name + members | `ErrorCategory.Transient` |
| YAML fields | camelCase | `totalCost`, `maxRetries` |

### Import Patterns

- `@/` path alias for cross-module imports: `import { foo } from '@/workspace/state-manager'`
- Relative imports ONLY within same module directory
- NO `../../` cross-module imports — always use `@/` alias
- Each module has a barrel `index.ts` controlling public API

### Testing Standards

- Co-located tests: `foo.ts` → `foo.test.ts` in same directory
- NO separate `__tests__/` or top-level `tests/` directory
- Vitest as test runner with `@/` alias resolution
- Test files import directly from the module they test

### Async/DI Patterns

- `async/await` everywhere — no callbacks, no `.then()` chains
- Function parameter dependency injection — no DI framework, no singletons
- All I/O operations are async with try/catch error handling

### Anti-Patterns (NEVER DO)

- `IAgentConfig` or `TAgentConfig` — no prefixes on types
- `state_manager.ts` or `StateManager.ts` — files are always kebab-case
- `throw new Error('...')` — always use typed error classes (Story 1.3+)
- `import { foo } from '../../../other-module/...'` — use `@/` aliases
- `.then().catch()` chains — use async/await
- Separate `__tests__/` directories — tests are co-located

### tsconfig.json Specifics

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

### tsup.config.ts Specifics

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
})
```

### vitest.config.ts Specifics

Note: `__dirname` is not available in ES modules. Use `import.meta.url` approach:

```typescript
import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

### CLI Command Pattern

Each command follows this pattern in its own file:

```typescript
import { Command } from 'commander'

export function registerBuildCommand(program: Command): void {
  program
    .command('build <artifact-path>')
    .description('Run the full build pipeline')
    .action((artifactPath: string) => {
      console.log('Build command not yet implemented')
    })
}
```

The main `src/index.ts` creates the program and wires all commands:

```typescript
import { Command } from 'commander'
import { registerBuildCommand, registerRetryCommand, registerStatusCommand, registerCostCommand } from '@/cli'

const program = new Command()
program
  .name('startup-factory')
  .version('0.1.0')
  .description('Autonomous MVP builder powered by AI agents')

registerBuildCommand(program)
registerRetryCommand(program)
registerStatusCommand(program)
registerCostCommand(program)

program.parse()
```

### Project Structure Notes

- This is the **first story** — creates the foundational scaffold for the entire project
- All module directories are stubs at this point — only `cli/` has real implementation
- Subsequent stories build on this scaffold: Story 1.2 (config), Story 1.3 (errors), Epic 2 (workspace), Epic 3 (agents/orchestrator)
- The `bin/` directory from architecture doc is NOT needed — tsup outputs to `dist/` and package.json `bin` field points to `dist/index.js`

### References

- [Source: docs/planning-artifacts/architecture.md#Starter-Template-Evaluation] — Custom minimal setup rationale
- [Source: docs/planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — Full project tree
- [Source: docs/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — Naming and structural conventions
- [Source: docs/planning-artifacts/architecture.md#Core-Architectural-Decisions] — State file, workspace, agent config patterns
- [Source: docs/planning-artifacts/epics.md#Story-1.1] — Story requirements and acceptance criteria
- [Source: docs/planning-artifacts/prd.md#CLI-Tool-Specific-Requirements] — Command structure and output format requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Initialized npm project with `"type": "module"`, version 0.1.0
- Installed all production deps (commander@14, @anthropic-ai/claude-agent-sdk, yaml) and dev deps (typescript@5, @types/node, vitest, tsup, @commander-js/extra-typings, tsx)
- Configured tsconfig.json with strict mode, ES2022, ESNext modules, NodeNext resolution, @/ path alias
- Configured tsup for ESM bundling with node20 target and shebang banner
- Configured vitest with @/ alias resolution and co-located test pattern
- Created 8 module directories with barrel index.ts files (cli, orchestrator, agents, workspace, cost, output, config, errors)
- Implemented 4 CLI commands (build, retry, status, cost) following the register pattern with Commander.js
- Created barrel re-exports in src/cli/index.ts
- Wired all commands in src/index.ts main entry point
- Created unit tests for build command registration (2 tests passing)
- Verified tsup build produces dist/index.js with shebang
- Verified `--help` output shows all 4 commands

### Implementation Plan

Followed story tasks sequentially: project init -> tooling config -> module structure -> CLI commands -> tests & verification.

### File List

- package.json (new)
- package-lock.json (new)
- tsconfig.json (new)
- tsup.config.ts (new)
- vitest.config.ts (new)
- .gitignore (modified)
- .env.example (new)
- src/index.ts (new)
- src/cli/index.ts (new)
- src/cli/build-command.ts (new)
- src/cli/build-command.test.ts (new)
- src/cli/retry-command.ts (new)
- src/cli/status-command.ts (new)
- src/cli/cost-command.ts (new)
- src/cli/retry-command.test.ts (new — added by code review)
- src/cli/status-command.test.ts (new — added by code review)
- src/cli/cost-command.test.ts (new — added by code review)
- src/orchestrator/index.ts (new)
- src/agents/index.ts (new)
- src/workspace/index.ts (new)
- src/cost/index.ts (new)
- src/output/index.ts (new)
- src/config/index.ts (new)
- src/errors/index.ts (new)

## Change Log

- 2026-03-05: Story 1.1 implemented — project scaffold with CLI entry point, all 4 commands (build, retry, status, cost), TypeScript/tsup/vitest tooling configured, 8 module directories created with barrel files
- 2026-03-05: Code review fixes — removed typo `.dmux/` from .gitignore; fixed tsconfig moduleResolution from NodeNext to bundler (NodeNext incompatible with @/ path aliases); added `engines` field and `typecheck` script to package.json; added explicit `dts: false` to tsup config; added tests for retry-command, status-command, cost-command (8 tests total now passing)
