---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-05'
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/product-brief-startup-factory-2026-03-05.md
  - docs/brainstorming/brainstorming-session-2026-03-05-2345.md
workflowType: 'architecture'
project_name: 'startup-factory'
user_name: 'Ty'
date: '2026-03-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
42 functional requirements across 8 capability areas. The core architectural challenge is the orchestration layer — dispatching agents, tracking state, handling failures, and coordinating through the filesystem. Individual agents (Story Creator, Developer, Code Reviewer, QA) are LLM-powered specialists with well-defined input/output contracts. The CLI interface is straightforward (4 commands: build, retry, status, cost) with structured output formats.

**Non-Functional Requirements:**
- **Performance:** 10-15 story MVP must complete within 12 hours. Agent dispatch overhead < 5 seconds. Real-time terminal output with minimal lag.
- **Security:** API keys via env vars or excluded config files, never logged. No hardcoded secrets in generated code. No remote transmission of workspace contents beyond necessary LLM API calls.
- **Integration:** Anthropic API as primary LLM provider. Must handle rate limits, timeouts, and transient errors gracefully. Architecture must allow adding additional providers post-MVP.
- **Reliability:** 12-hour unattended operation without crashes. Crash-safe state file (no corruption on unclean exit). Partial progress preserved. Agent failures isolated from pipeline-level crashes.

**Scale & Complexity:**

- Primary domain: CLI tool / backend orchestration
- Complexity level: Medium
- Estimated architectural components: 6-8 (CLI parser, orchestrator/dispatcher, state manager, workspace manager, agent runner/interface, cost tracker, output formatter, config loader)

### Technical Constraints & Dependencies

- **LLM API dependency:** Core functionality depends on external LLM API availability and capability. Rate limits, timeouts, and model availability directly affect system behavior.
- **Single-user, single-machine:** No concurrency concerns for MVP. One build run at a time.
- **Context window limits:** Stories must fit in a single agent context window. Sizing is a spec-level concern, not an architecture concern for MVP.
- **Filesystem as protocol:** All inter-agent communication through files. No database, no message queue, no custom IPC.
- **Solo developer:** Architecture must be simple enough for one person to build and maintain. Complexity budget is tight.

### Cross-Cutting Concerns Identified

- **State management:** The YAML state file is the single source of truth for pipeline coordination. Every component reads from or writes to it. Schema design is critical.
- **Cost tracking:** Every agent dispatch must log tokens, model tier, and estimated cost. Accumulates per-story and per-run. Surfaces through CLI and state file.
- **Failure handling:** Every agent dispatch can fail. The orchestrator must track failure counts, escalation tier, and failure notes per story. Failure state drives dispatch decisions.
- **Workspace conventions:** Every agent reads from and writes to the shared workspace directory. File naming, directory structure, and content format conventions must be consistent and well-defined.
- **Logging/output:** Structured log lines during execution, completion summaries, and state file updates. Multiple output consumers (terminal, state file, JSON/YAML export).

## Starter Template Evaluation

### Primary Technology Domain

CLI tool / backend orchestrator built on TypeScript + Node.js, based on project requirements for a batch-mode CLI that dispatches LLM-powered agents.

### Technical Preferences Established

- **Language:** TypeScript on Node.js (user's primary comfort zone)
- **Distribution:** npm package
- **Agent Runtime:** Anthropic Claude Agent SDK as primary agent execution layer
- **Model Failover:** Architecture must support adding alternative LLM providers post-MVP

### Starter Options Considered

| Option | Assessment |
|--------|-----------|
| `khalidx/typescript-cli-starter` | Zero-opinion, good structure, but too generic — doesn't account for Agent SDK integration |
| `kucherenko/cli-typescript-starter` | More opinionated with logging and testing built in, but includes unnecessary complexity (Consola, semantic-release) |
| `ryansonshine/typescript-npm-cli-template` | Good npm publishing setup, but template-based (GitHub template, not CLI generator) |
| **Custom minimal setup** | Tailored to exact needs — Commander + Agent SDK + Vitest. No unnecessary dependencies. |

### Selected Approach: Custom Minimal Setup

**Rationale:** No existing starter template provides meaningful value for this project's specific combination of Commander.js CLI parsing + Claude Agent SDK agent execution. A custom setup with hand-picked dependencies avoids unnecessary abstraction layers and keeps the complexity budget tight (solo developer constraint).

**Initialization:**

```bash
mkdir startup-factory && cd startup-factory
npm init -y
npm install commander@14 @anthropic-ai/claude-agent-sdk yaml
npm install -D typescript@5 @types/node vitest tsup @commander-js/extra-typings
npx tsc --init
```

**Architectural Decisions Established:**

**Language & Runtime:**
- TypeScript 5.x with strict mode on Node.js 20+
- ES modules (`"type": "module"` in package.json)

**CLI Framework:**
- Commander.js v14 with `@commander-js/extra-typings` for type-safe argument parsing
- 4 commands: `build`, `retry`, `status`, `cost`

**Agent Execution:**
- `@anthropic-ai/claude-agent-sdk` for dispatching specialist agents with built-in tools (Read, Write, Edit, Bash, Glob, Grep)
- Each pipeline agent (Story Creator, Developer, Code Reviewer, QA) runs as a separate Agent SDK session with role-specific system prompts and tool permissions

**State & Config Parsing:**
- `yaml` package for reading/writing YAML state files and config

**Build Tooling:**
- `tsup` for bundling TypeScript to distributable CLI binary
- Single entry point, tree-shaken output

**Testing Framework:**
- Vitest (fast, TypeScript-native, compatible with Node.js test patterns)

**Code Organization:**
```
src/
  cli/           # Commander command definitions
  orchestrator/  # Dispatch logic, state machine, event loop
  agents/        # Agent configurations, prompts, tool permissions
  workspace/     # Workspace and state file management
  cost/          # Cost tracking and reporting
  output/        # Terminal output formatting, structured logging
  config/        # Config loading and CLI flag merging
  index.ts       # Entry point
```

**Development Experience:**
- `tsx` for development execution (no compile step during dev)
- Vitest watch mode for test-driven development
- tsup for production builds

**Note:** Project initialization using this setup should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- State file schema (hierarchical by epic)
- Workspace directory structure and conventions
- Agent configuration pattern (hybrid: typed config + external prompts)
- Model provider abstraction (thin interface)

**Important Decisions (Shape Architecture):**
- Structured logging format (human-first with JSON flag)
- Error categorization (4-tier: transient, capability, specification, system)

**Deferred Decisions (Post-MVP):**
- Parallel epic execution (architecture supports it via epic-level isolation)
- Additional model provider implementations (interface ready, implementations deferred)
- CI/CD pipeline configuration
- Cost circuit breaker thresholds

### State File Architecture

**Decision:** Hierarchical by epic with run-level metadata as sibling

**Rationale:** Epic-level grouping provides natural isolation boundaries for future parallel execution. Run-level metadata (start time, config snapshot, cumulative cost) lives as a sibling to epics at the top level. Total cost is computed from stories on read to avoid sync issues.

**Schema:**
```yaml
run:
  status: running
  started: 2026-03-05T22:00:00Z
  config:
    defaultModel: claude-sonnet-4-6
    maxRetries: 3
  totalCost: 4.23
epics:
  epic-1:
    status: in-progress
    stories:
      story-1:
        status: completed
        phase: qa
        attempts: 1
        cost: 0.42
      story-2:
        status: failed
        phase: dev
        attempts: 3
        escalationTier: 2
        cost: 1.87
        failureNote: stories/1-2/failures/attempt-3.md
```

### Workspace Directory Structure

**Decision:** Hidden dotfile workspace with epic-story directory naming using BMAD identifiers

**Structure:**
```
.startup-factory/
  state.yaml
  config.yaml
  artifacts/                    # BMAD planning artifacts (input)
  stories/
    {epic}-{story}/             # e.g., 1-1, auth-login
      spec.md                   # Story spec (Story Creator output)
      review.md                 # Code review feedback
      qa-report.md              # QA test results
      failures/
        attempt-1.md            # Structured failure notes per attempt
        attempt-2.md
```

**Naming Convention:** Flexible `{epic}-{story}` format using whatever identifiers BMAD produces. Orchestrator treats directory names as opaque keys matching state file entries.

### Agent Configuration Pattern

**Decision:** Hybrid — structural config in TypeScript, system prompts as external markdown

**Rationale:** Prompts are iterated frequently and benefit from editability without rebuild. Structural config (tool permissions, model tier, retry behavior) changes rarely and benefits from type safety.

**Layout:**
```
src/agents/
  story-creator/
    config.ts          # Tool permissions, model tier, retry settings
    prompt.md          # System prompt loaded at runtime
  developer/
    config.ts
    prompt.md
  code-reviewer/
    config.ts
    prompt.md
  qa/
    config.ts
    prompt.md
```

### Error Handling & Logging

**Structured Logging:**
Human-readable output by default (`[22:01:03] Starting story 1-1 with developer agent`), with `--json` flag switching to JSON lines for machine consumption. Aligns with PRD's `--output json` flag for completion summaries.

**Error Categorization:**

| Category | Meaning | Orchestrator Response |
|----------|---------|----------------------|
| `transient` | API timeout, rate limit, network error | Retry same model tier |
| `capability` | Agent couldn't complete the task | Escalate to higher model tier |
| `specification` | Ambiguous or conflicting spec | Flag for human attention |
| `system` | Orchestrator bug, file I/O error | Halt and report |

Maps directly to the three-tier escalation ladder: transient → retry, capability → escalate, specification → human flag, system → hard stop.

### Model Provider Abstraction

**Decision:** Thin `AgentRunner` interface with single MVP implementation

```typescript
interface AgentRunner {
  run(config: AgentConfig): Promise<AgentResult>
}
```

**Rationale:** MVP implements `ClaudeAgentRunner` wrapping the Agent SDK. Adding providers in Phase 2 is additive (new implementation) rather than surgical (refactoring). The orchestrator never couples to a specific provider.

**Acknowledged constraint:** The Claude Agent SDK provides built-in tools (file editing, bash, glob, grep) that a raw API failover provider would need to replicate or accept reduced capability. This is a Phase 2 design problem documented here for visibility.

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (starter setup from Step 3)
2. State file schema and workspace manager (foundation for everything)
3. Config loader (needed before agent dispatch)
4. Agent configuration pattern and prompt files
5. AgentRunner interface + ClaudeAgentRunner implementation
6. Orchestrator dispatch logic with error categorization
7. CLI commands wiring it all together
8. Cost tracking and structured logging

**Cross-Component Dependencies:**
- Orchestrator depends on state file schema, error categorization, and AgentRunner interface
- All agents depend on workspace conventions and agent config pattern
- CLI output depends on logging format decisions
- Cost tracking integrates with state file and AgentRunner result type

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

11 areas where AI agents could make different choices, organized into naming, structural, and process categories.

### Naming Patterns

**File Naming:**
- Source files: kebab-case (`state-manager.ts`, `agent-runner.ts`)
- Test files: co-located with `.test.ts` suffix (`state-manager.test.ts`)
- Type definition files: kebab-case (`agent-config.ts`)
- Agent prompt files: kebab-case (`prompt.md`)

**Code Naming:**
- Functions/variables: camelCase (`getNextStory`, `storyStatus`)
- Types/interfaces: PascalCase, no prefix (`AgentConfig`, `StoryStatus` — not `IAgentConfig`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_MODEL`)
- Enums: PascalCase name, PascalCase members (`ErrorCategory.Transient`)

**YAML Field Naming:**
- All YAML fields in state and config files: camelCase (`totalCost`, `maxRetries`, `escalationTier`)
- Matches TypeScript object properties directly — no transformation layer needed

### Structure Patterns

**Test Organization:**
- Co-located tests: each `foo.ts` has a `foo.test.ts` in the same directory
- No separate `__tests__/` or top-level `tests/` directory
- Test files import directly from the module they test

**Module Exports:**
- Each module directory has an `index.ts` barrel file
- Barrel files control the public API of each module
- Internal implementation files are not re-exported unless needed externally

**Import Style:**
- Path aliases using `@/` prefix (`import { StateManager } from '@/workspace/state-manager'`)
- No relative path imports across module boundaries (no `../../orchestrator/...`)
- Relative imports only within the same module directory

### Process Patterns

**Error Handling:**
- Custom error classes extending `Error` with `category: ErrorCategory` field
- Error categories: `Transient`, `Capability`, `Specification`, `System`
- All errors thrown as typed instances — never raw `throw new Error('...')`
- Example:
```typescript
class AgentError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly storyId: string,
    public readonly cause?: Error
  ) {
    super(message)
  }
}
```

**Async Patterns:**
- `async/await` everywhere — no callbacks, no `.then()` chains
- All I/O operations (file reads, API calls, YAML parsing) are async
- Errors in async code caught with try/catch, never `.catch()`

**Dependency Injection:**
- Function parameters — pass dependencies explicitly
- No DI framework, no module-level singletons
- Enables testing by passing mock implementations directly
- Example:
```typescript
function dispatchAgent(
  runner: AgentRunner,
  state: StateManager,
  config: AgentConfig
): Promise<AgentResult>
```

### Enforcement Guidelines

**All AI Agents MUST:**
- Follow naming conventions exactly — no exceptions for "personal preference"
- Use barrel imports when importing across module boundaries
- Throw typed `AgentError` instances with correct `ErrorCategory`
- Use `async/await` for all asynchronous operations
- Co-locate test files with source files
- Use path aliases for cross-module imports

**Anti-Patterns (Never Do This):**
- `IAgentConfig` or `TAgentConfig` — no prefixes on types
- `state_manager.ts` or `StateManager.ts` — files are always kebab-case
- `total_cost` in YAML — always camelCase
- `throw new Error('something failed')` — always use typed error classes
- `import { foo } from '../../../other-module/...'` — use `@/` aliases
- `.then().catch()` chains — use async/await

## Project Structure & Boundaries

### Complete Project Directory Structure

```
startup-factory/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .env.example                    # ANTHROPIC_API_KEY, etc.
├── .gitignore
├── README.md
├── bin/
│   └── startup-factory.js          # CLI entry point (built output)
├── src/
│   ├── index.ts                    # Main entry, Commander program setup
│   ├── cli/
│   │   ├── index.ts
│   │   ├── build-command.ts        # FR1, FR35: build <artifact-path>
│   │   ├── build-command.test.ts
│   │   ├── retry-command.ts        # FR12, FR36: retry <story-id>
│   │   ├── retry-command.test.ts
│   │   ├── status-command.ts       # FR37: status
│   │   ├── status-command.test.ts
│   │   ├── cost-command.ts         # FR38: cost
│   │   └── cost-command.test.ts
│   ├── orchestrator/
│   │   ├── index.ts
│   │   ├── dispatcher.ts           # FR3, FR6: Sequential agent dispatch loop
│   │   ├── dispatcher.test.ts
│   │   ├── escalation.ts           # FR7-9: Three-tier escalation logic
│   │   ├── escalation.test.ts
│   │   ├── pipeline.ts             # FR3: Story Creator → Dev → Review → QA
│   │   └── pipeline.test.ts
│   ├── agents/
│   │   ├── index.ts
│   │   ├── agent-runner.ts         # AgentRunner interface
│   │   ├── agent-runner.test.ts
│   │   ├── claude-agent-runner.ts  # ClaudeAgentRunner implementation
│   │   ├── claude-agent-runner.test.ts
│   │   ├── types.ts                # AgentConfig, AgentResult types
│   │   ├── story-creator/
│   │   │   ├── config.ts           # FR17-18: Tool permissions, model tier
│   │   │   └── prompt.md
│   │   ├── developer/
│   │   │   ├── config.ts           # FR19-21: Tool permissions, model tier
│   │   │   └── prompt.md
│   │   ├── code-reviewer/
│   │   │   ├── config.ts           # FR22-24: Tool permissions, model tier
│   │   │   └── prompt.md
│   │   └── qa/
│   │       ├── config.ts           # FR25-27: Tool permissions, model tier
│   │       └── prompt.md
│   ├── workspace/
│   │   ├── index.ts
│   │   ├── state-manager.ts        # FR5: Read/write state.yaml, CRUD operations
│   │   ├── state-manager.test.ts
│   │   ├── workspace-manager.ts    # FR13-16: Directory creation, artifact management
│   │   ├── workspace-manager.test.ts
│   │   ├── failure-notes.ts        # FR10-11: Write/read structured failure notes
│   │   ├── failure-notes.test.ts
│   │   └── types.ts                # State file types, StoryStatus, EpicStatus
│   ├── config/
│   │   ├── index.ts
│   │   ├── config-loader.ts        # FR28-29: YAML config + CLI flag merging
│   │   ├── config-loader.test.ts
│   │   ├── schema.ts               # FR30-31: Config schema and validation
│   │   └── types.ts                # Config types
│   ├── cost/
│   │   ├── index.ts
│   │   ├── cost-tracker.ts         # FR32-33: Per-agent, per-story cost logging
│   │   ├── cost-tracker.test.ts
│   │   └── types.ts                # CostEntry, CostSummary types
│   ├── output/
│   │   ├── index.ts
│   │   ├── logger.ts               # FR39: Structured log lines to stdout
│   │   ├── logger.test.ts
│   │   ├── summary.ts              # FR40-41: Completion summary (text/JSON/YAML)
│   │   └── summary.test.ts
│   └── errors/
│       ├── index.ts
│       ├── agent-error.ts          # AgentError class with ErrorCategory
│       └── agent-error.test.ts
└── dist/                           # tsup build output
```

### Architectural Boundaries

**CLI → Orchestrator Boundary:**
- CLI commands parse arguments and delegate to orchestrator
- CLI never directly dispatches agents or manages state
- CLI is responsible for output formatting (text vs JSON) based on flags
- Orchestrator returns structured results; CLI formats them for display

**Orchestrator → Agents Boundary:**
- Orchestrator calls `AgentRunner.run()` — never imports Claude SDK directly
- Orchestrator provides agent config and receives `AgentResult`
- Orchestrator owns dispatch decisions (what to run next, when to escalate)
- Agents own execution (how to complete the task)

**Orchestrator → Workspace Boundary:**
- Orchestrator reads/writes state through `StateManager` — never touches `state.yaml` directly
- Workspace manager handles directory creation and file I/O
- Failure notes written through `FailureNotes` module, not raw file writes

**Agents → Workspace Boundary:**
- Agents read from workspace (story specs, failure notes, BMAD artifacts) via their Agent SDK file tools
- Agents write to workspace (code, reviews, QA reports) via their Agent SDK file tools
- Agents do NOT read or write `state.yaml` — only the orchestrator manages state

**Config → Everything Boundary:**
- Config is loaded once at startup and passed as a dependency
- No component reads config files directly — all receive typed config objects

### Requirements to Structure Mapping

**FR Category Mapping:**

| FR Range | Category | Primary Location | Integration Points |
|----------|----------|-----------------|-------------------|
| FR1-6 | Build Orchestration | `src/orchestrator/` | workspace, agents, config |
| FR7-12 | Failure & Escalation | `src/orchestrator/escalation.ts` | workspace/failure-notes, agents |
| FR13-16 | Agent Workspace | `src/workspace/` | agents (read/write), orchestrator (state) |
| FR17-18 | Story Creation | `src/agents/story-creator/` | workspace (BMAD artifacts in, specs out) |
| FR19-21 | Development | `src/agents/developer/` | workspace (specs in, code out) |
| FR22-24 | Code Review | `src/agents/code-reviewer/` | workspace (code in, review out) |
| FR25-27 | QA & Testing | `src/agents/qa/` | workspace (code in, qa-report out) |
| FR28-31 | Configuration | `src/config/` | all components (dependency) |
| FR32-34 | Cost Tracking | `src/cost/` | orchestrator, state file |
| FR35-42 | CLI Interface | `src/cli/` | orchestrator, output |

**Cross-Cutting Concerns Mapping:**

| Concern | Files | Touches |
|---------|-------|---------|
| State management | `src/workspace/state-manager.ts`, `src/workspace/types.ts` | orchestrator, CLI (status/cost) |
| Error handling | `src/errors/agent-error.ts` | all components |
| Cost tracking | `src/cost/cost-tracker.ts` | orchestrator (writes), CLI (reads) |
| Logging | `src/output/logger.ts` | orchestrator, CLI |

### Data Flow

```
BMAD Artifacts (input)
    ↓
[Config Loader] → typed config object
    ↓
[CLI: build command] → orchestrator.run(config, artifactPath)
    ↓
[Workspace Manager] → creates .startup-factory/, copies artifacts
    ↓
[State Manager] → initializes state.yaml with epics/stories
    ↓
[Dispatcher] → event loop: read state → pick next story → pick agent phase
    ↓
[AgentRunner.run()] → dispatches agent with config + prompt
    ↓
[Agent SDK Session] → agent reads workspace, does work, writes output
    ↓
[AgentResult] → success/failure + cost data
    ↓
[Cost Tracker] → logs cost to state file
    ↓
[Escalation] (if failure) → categorize error → retry/escalate/flag
    ↓
[State Manager] → updates story status
    ↓
[Dispatcher] → loop back to pick next
    ↓
[Summary] → completion report to stdout
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
All technology choices verified compatible. Commander.js v14 + TypeScript 5.x + Node.js 20+ + Claude Agent SDK + Vitest + tsup — no version conflicts. YAML camelCase fields match TypeScript object properties directly.

**Pattern Consistency:**
All naming, structural, and process patterns are internally consistent. Co-located tests reflected in project tree. Async/await pattern aligns with Agent SDK's async API. Function parameter DI aligns with AgentRunner interface.

**Structure Alignment:**
Every architectural decision has a corresponding module in the project structure. Agent config pattern (config.ts + prompt.md) reflected in tree. Boundaries clearly enforced through module separation.

### Requirements Coverage Validation

**Functional Requirements: 42/42 Covered**

| FR Range | Category | Architectural Support |
|----------|----------|----------------------|
| FR1-6 | Build Orchestration | `orchestrator/dispatcher.ts`, `orchestrator/pipeline.ts` |
| FR7-12 | Failure & Escalation | `orchestrator/escalation.ts`, `workspace/failure-notes.ts` |
| FR13-16 | Agent Workspace | `workspace/workspace-manager.ts`, `workspace/state-manager.ts` |
| FR17-18 | Story Creation | `agents/story-creator/` |
| FR19-21 | Development | `agents/developer/` |
| FR22-24 | Code Review | `agents/code-reviewer/` |
| FR25-27 | QA & Testing | `agents/qa/` |
| FR28-31 | Configuration | `config/config-loader.ts`, `config/schema.ts` |
| FR32-34 | Cost Tracking | `cost/cost-tracker.ts` |
| FR35-42 | CLI Interface | `cli/` (4 commands), `output/logger.ts`, `output/summary.ts` |

**Non-Functional Requirements: All Covered**

| NFR | Status | How Addressed |
|-----|--------|--------------|
| Performance (<12hr, <5s dispatch) | Covered | Sequential dispatch, minimal abstraction overhead |
| Security (API keys, no secrets) | Covered | `.env.example` pattern, config boundary prevents leaking |
| Integration (Anthropic + future) | Covered | `AgentRunner` interface, `ClaudeAgentRunner` MVP impl |
| Reliability (12hr, crash-safe) | Covered | Atomic state writes, partial progress preserved, agent failures isolated |

### Gaps Identified and Resolved

**Gap 1: Crash-Safe State Writes (Critical — Resolved)**

StateManager must use atomic writes to prevent state file corruption on unclean exit. Pattern: write to `.state.yaml.tmp`, then rename to `state.yaml`. Rename is atomic on POSIX filesystems, ensuring the state file is always either the old complete version or the new complete version — never a partial write.

**Gap 2: BMAD Artifact Validation (Important — Resolved)**

FR2 requires validating BMAD planning artifacts on ingestion. Validation checks for required files:
- **Required:** PRD (`*prd*.md`), Architecture doc (`*architecture*.md`), Epics/Stories (`*epic*.md` or `*stories*.md`)
- **Optional:** UX Design (`*ux*.md`), Research docs (`*research*.md`)

Validation lives in `workspace/workspace-manager.ts` as part of artifact ingestion. Build command fails with clear error if required files are missing.

**Gap 3: Exit Codes (Minor — Resolved)**

FR42 exit codes handled in `src/index.ts` (process entry point):
- `0` — full success (all stories completed)
- `1` — partial success (some stories failed)
- `2` — total failure (no stories completed or system error)

**Gap 4: Story Phase Enum (Minor — Resolved)**

Valid `phase` values for state file story tracking:
- `pending` — not yet started
- `storyCreation` — Story Creator agent active
- `development` — Developer agent active
- `codeReview` — Code Reviewer agent active
- `qa` — QA agent active
- `completed` — all phases passed
- `failed` — exhausted escalation, flagged for human

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] State file schema defined with example
- [x] Workspace structure and conventions defined
- [x] Agent configuration pattern specified
- [x] Error categorization and escalation mapping defined
- [x] Model provider abstraction interface defined

**Implementation Patterns**
- [x] Naming conventions established (files, code, YAML)
- [x] Structure patterns defined (tests, modules, imports)
- [x] Process patterns documented (errors, async, DI)
- [x] Enforcement guidelines with anti-patterns listed

**Project Structure**
- [x] Complete directory structure with all files
- [x] Component boundaries established
- [x] FR-to-structure mapping complete
- [x] Data flow documented

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean separation of concerns — each module has a single responsibility
- Thin abstractions — AgentRunner interface, function parameter DI, no frameworks
- State file as single source of truth with atomic writes for crash safety
- Agent config pattern allows prompt iteration without rebuilds
- Every FR mapped to a specific file in the project structure
- Error categorization directly drives escalation behavior — no ambiguity

**Areas for Future Enhancement:**
- Parallel epic execution (architecture supports it via epic-level isolation in state file)
- Additional model provider implementations behind AgentRunner interface
- Cost circuit breaker (state file tracks cost, threshold logic deferred)
- BMAD artifact validation could expand beyond file existence to structural validation

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and module boundaries
- Refer to this document for all architectural questions
- Use atomic writes for all state file updates
- Validate BMAD artifacts before starting pipeline

**First Implementation Priority:**
1. Project scaffold — run initialization commands from Starter Template section
2. State file types and StateManager with atomic writes
3. Workspace manager with BMAD artifact validation
