---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
---

# startup-factory - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for startup-factory, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Operator can initiate a full build pipeline by specifying a path to BMAD planning artifacts
FR2: System can read and validate BMAD planning artifacts (PRD, architecture doc, epics/stories, UX specs) as input
FR3: System can dispatch agents sequentially through the Story Creator -> Developer -> Code Reviewer -> QA pipeline
FR4: System can detect when a story is blocked and skip it to continue with non-colliding stories
FR5: System can track pipeline state in a structured YAML state file as single source of truth
FR6: System can execute the full pipeline without interactive user input (batch mode)
FR7: System can retry a failed agent run with a fresh agent instance
FR8: System can escalate a failed story to a more capable model tier
FR9: System can flag a story for human attention after exhausting escalation options
FR10: System can write structured failure notes to the workspace directory after each failed attempt
FR11: System can use failure notes from previous attempts to inform subsequent retry attempts
FR12: Operator can selectively re-run specific failed stories without re-running the full pipeline
FR13: System can maintain a shared workspace directory for inter-agent communication
FR14: Agents can read context from the workspace and state file (pull-based)
FR15: Agents can write outputs and artifacts to the workspace directory
FR16: System can store failure notes, agent outputs, and handoff artifacts in the workspace
FR17: Story Creator agent can consume BMAD planning artifacts and generate implementation-ready story specs
FR18: Story Creator agent can produce story specs with clear acceptance criteria
FR19: Developer agent can implement a story based on its story spec
FR20: Developer agent can write functional code and corresponding tests
FR21: Developer agent can read and incorporate context from the workspace
FR22: Code Reviewer agent can review generated code for quality, correctness, and spec adherence
FR23: Code Reviewer agent can provide actionable feedback when code does not meet standards
FR24: Code Reviewer agent can approve code that meets functional and maintainability standards
FR25: QA agent can run tests and validate that the application starts
FR26: QA agent can validate app behavior against story spec acceptance criteria
FR27: QA agent can report test results (pass/fail) with details per story
FR28: Operator can configure system behavior via a YAML config file in the project root
FR29: Operator can override config values via CLI flags (flags take precedence)
FR30: Operator can configure default model tier and escalation model order
FR31: Operator can configure max retry attempts before human flagging
FR32: System can log token usage, model tier used, and estimated cost per agent run
FR33: System can tally cumulative cost per story and per full build run
FR34: Operator can view cost breakdown in CLI output and state file
FR35: Operator can run a build command targeting a BMAD artifacts path
FR36: Operator can run a retry command targeting specific failed stories
FR37: Operator can run a status command to view current/last run state
FR38: Operator can run a cost command to view cost breakdown
FR39: System can output structured log lines to stdout during execution (agent dispatch, story progress, escalations, failures)
FR40: System can output a completion summary to stdout with stories completed/failed, tests passed, and cost
FR41: Operator can request completion summary in YAML or JSON format via CLI flag
FR42: System can return meaningful exit codes (0 = full success, 1 = partial success, 2 = total failure)

### NonFunctional Requirements

NFR1: Build pipeline throughput must support completing a simple MVP (10-15 stories) within 12 hours
NFR2: Individual agent dispatch overhead (orchestrator processing between agent runs) must be under 5 seconds
NFR3: State file reads/writes must not bottleneck the pipeline
NFR4: Real-time terminal output must not lag behind actual agent progress by more than a few seconds
NFR5: LLM provider API keys must be stored securely via environment variables or config file excluded from version control, never logged to stdout or state files
NFR6: Generated code must not contain hardcoded secrets or credentials
NFR7: Workspace directory contents must not be transmitted remotely beyond necessary LLM API calls
NFR8: Must support Anthropic API as primary LLM provider
NFR9: Architecture must allow adding additional LLM providers for escalation and failover post-MVP
NFR10: Must handle LLM API rate limits gracefully with backoff and retry without crashing
NFR11: Must handle LLM API timeouts and transient errors without pipeline failure
NFR12: Pipeline must run unattended for up to 12 hours without crashing
NFR13: Unclean exits must not corrupt the state file - state must be recoverable
NFR14: Partial progress must be preserved - if the process dies after N stories complete, those stories' work is retained
NFR15: Orchestrator must handle individual agent failures without pipeline-level crashes (agent failure != system failure)

### Additional Requirements

From Architecture:

- Custom minimal project scaffold (no starter template): TypeScript 5.x + Node.js 20+, ES modules, Commander.js v14, Claude Agent SDK, yaml package, tsup, Vitest
- State file uses hierarchical schema organized by epic with run-level metadata as sibling; atomic writes (write to .state.yaml.tmp then rename) for crash safety
- BMAD artifact validation on ingestion: required files (PRD, Architecture, Epics/Stories), optional files (UX Design, Research)
- Hidden dotfile workspace (.startup-factory/) with epic-story directory naming
- Agent configuration pattern: hybrid with structural config in TypeScript (config.ts) and system prompts as external markdown (prompt.md)
- AgentRunner interface for model provider abstraction with ClaudeAgentRunner as MVP implementation
- Error categorization: 4-tier (transient, capability, specification, system) mapping directly to escalation behavior
- Story phase tracking enum: pending, storyCreation, development, codeReview, qa, completed, failed
- Code organization: 7 modules (cli, orchestrator, agents, workspace, cost, output, config, errors)
- Path aliases using @/ prefix for cross-module imports
- Co-located test files with .test.ts suffix
- Barrel file (index.ts) exports per module
- Function parameter dependency injection (no DI framework)
- Naming conventions: kebab-case files, camelCase code, PascalCase types, UPPER_SNAKE_CASE constants, camelCase YAML fields

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 3 | Initiate build pipeline |
| FR2 | Epic 2 | Read and validate BMAD artifacts |
| FR3 | Epic 3 | Dispatch agents through pipeline |
| FR4 | Epic 4 | Detect blocked stories, skip to continue |
| FR5 | Epic 2 | Track state in YAML state file |
| FR6 | Epic 3 | Execute pipeline without user input |
| FR7 | Epic 4 | Retry failed agent with fresh instance |
| FR8 | Epic 4 | Escalate to more capable model |
| FR9 | Epic 4 | Flag story for human attention |
| FR10 | Epic 4 | Write structured failure notes |
| FR11 | Epic 4 | Use failure notes to inform retries |
| FR12 | Epic 4 | Selective re-run of failed stories |
| FR13 | Epic 2 | Maintain shared workspace directory |
| FR14 | Epic 2 | Agents read from workspace (pull-based) |
| FR15 | Epic 2 | Agents write outputs to workspace |
| FR16 | Epic 2 | Store failure notes and handoff artifacts |
| FR17 | Epic 3 | Story Creator consumes BMAD artifacts |
| FR18 | Epic 3 | Story Creator produces story specs with AC |
| FR19 | Epic 3 | Developer implements story from spec |
| FR20 | Epic 3 | Developer writes code and tests |
| FR21 | Epic 3 | Developer reads workspace context |
| FR22 | Epic 3 | Code Reviewer reviews for quality |
| FR23 | Epic 3 | Code Reviewer provides actionable feedback |
| FR24 | Epic 3 | Code Reviewer approves passing code |
| FR25 | Epic 3 | QA runs tests, validates app starts |
| FR26 | Epic 3 | QA validates against acceptance criteria |
| FR27 | Epic 3 | QA reports pass/fail per story |
| FR28 | Epic 1 | Configure via YAML config file |
| FR29 | Epic 1 | Override config via CLI flags |
| FR30 | Epic 1 | Configure model tier and escalation order |
| FR31 | Epic 1 | Configure max retry attempts |
| FR32 | Epic 5 | Log token usage and cost per agent run |
| FR33 | Epic 5 | Tally cumulative cost per story/run |
| FR34 | Epic 5 | View cost breakdown in CLI and state file |
| FR35 | Epic 3 | Build command targeting artifacts path |
| FR36 | Epic 4 | Retry command targeting failed stories |
| FR37 | Epic 5 | Status command to view run state |
| FR38 | Epic 5 | Cost command to view cost breakdown |
| FR39 | Epic 3 | Structured log lines during execution |
| FR40 | Epic 5 | Completion summary output |
| FR41 | Epic 5 | Summary in YAML/JSON via flag |
| FR42 | Epic 1 | Meaningful exit codes |

## Epic List

### Epic 1: Project Foundation & Configuration
Operator can install the tool, configure it via YAML and CLI flags, and run CLI commands. The project is scaffolded with all dependencies, module structure, build tooling, and test framework in place.
**FRs covered:** FR28, FR29, FR30, FR31, FR42

## Epic 1: Project Foundation & Configuration

Operator can install the tool, configure it via YAML and CLI flags, and run CLI commands. The project is scaffolded with all dependencies, module structure, build tooling, and test framework in place.

### Story 1.1: Project Scaffold & CLI Entry Point

As an operator,
I want to install startup-factory and run it with `--help`,
So that I can verify the tool is installed and see available commands.

**Acceptance Criteria:**

**Given** the project is cloned and dependencies are installed
**When** the operator runs `startup-factory --help`
**Then** the CLI displays usage information with the 4 available commands (build, retry, status, cost)
**And** each command stub exists and prints a placeholder message when invoked

**Given** the project source code
**When** a developer inspects the project structure
**Then** the module directories exist (cli, orchestrator, agents, workspace, cost, output, config, errors) with barrel index.ts files
**And** TypeScript strict mode is enabled with ES modules and @/ path aliases configured
**And** tsup is configured to bundle to a distributable CLI binary
**And** Vitest is configured and a sample test passes

**Given** the project dependencies
**When** reviewing package.json
**Then** Commander.js v14, @anthropic-ai/claude-agent-sdk, yaml, TypeScript 5.x, @types/node, vitest, tsup, and @commander-js/extra-typings are installed

### Story 1.2: Configuration Loading & CLI Flag Merging

As an operator,
I want to define my preferences in a `startup-factory.yaml` config file and override them with CLI flags,
So that I can customize system behavior per-project and per-run.

**Acceptance Criteria:**

**Given** a `startup-factory.yaml` file exists in the project root with valid configuration
**When** the system loads configuration
**Then** it parses all config fields: models.default, models.escalation, retry.max_attempts, artifacts_path, workspace_path, cost.tracking

**Given** a config file sets `retry.max_attempts: 3`
**When** the operator passes `--max-retries 5` as a CLI flag
**Then** the effective config uses `5` for max retries (CLI flag takes precedence)

**Given** no config file exists
**When** the system loads configuration
**Then** it uses sensible defaults for all config values without crashing

**Given** a config file with invalid or missing fields
**When** the system loads configuration
**Then** it reports a clear validation error identifying the problematic fields

### Story 1.3: Error Types & Exit Codes

As an operator,
I want the tool to return meaningful exit codes and use typed errors internally,
So that I can integrate it into scripts and trust that failures are categorized correctly.

**Acceptance Criteria:**

**Given** all stories in a build complete successfully
**When** the process exits
**Then** the exit code is 0

**Given** some stories complete but others fail
**When** the process exits
**Then** the exit code is 1

**Given** no stories complete or a system-level error occurs
**When** the process exits
**Then** the exit code is 2

**Given** an error occurs during agent execution
**When** the error is created
**Then** it is an instance of AgentError with a category field set to one of: Transient, Capability, Specification, or System
**And** the error includes the storyId and an optional cause error

**Given** the ErrorCategory enum
**When** used throughout the codebase
**Then** Transient maps to retry behavior, Capability maps to model escalation, Specification maps to human flagging, and System maps to hard stop

---

## Epic 2: Workspace Management & Artifact Ingestion

System can initialize a build workspace, validate BMAD planning artifacts, and track pipeline state reliably with crash-safe atomic writes.

### Story 2.1: Workspace Initialization & Directory Structure

As a system,
I want to create and manage a `.startup-factory/` workspace directory with proper structure,
So that agents have a consistent filesystem layout for reading and writing artifacts.

**Acceptance Criteria:**

**Given** an operator initiates a build
**When** the workspace manager initializes
**Then** it creates the `.startup-factory/` directory with subdirectories: `artifacts/`, `stories/`
**And** the workspace path is configurable via the config file

**Given** the workspace already exists from a previous run
**When** the workspace manager initializes
**Then** it preserves existing content and does not overwrite previous story outputs

**Given** a story needs a workspace directory
**When** the workspace manager creates a story directory
**Then** it follows the `{epic}-{story}` naming convention (e.g., `stories/1-1/`)
**And** creates subdirectories for `failures/` within each story directory

### Story 2.2: BMAD Artifact Validation & Ingestion

As an operator,
I want the system to validate that my BMAD planning artifacts are complete before starting a build,
So that I get a clear error if required documents are missing rather than a confusing pipeline failure.

**Acceptance Criteria:**

**Given** a valid artifacts path containing PRD, Architecture, and Epics/Stories documents
**When** the system validates the artifacts
**Then** it identifies all required files as present and reports success

**Given** an artifacts path missing one or more required documents (PRD, Architecture, or Epics/Stories)
**When** the system validates the artifacts
**Then** it fails with a clear error listing which required documents are missing

**Given** an artifacts path with optional documents (UX Design, Research)
**When** the system validates the artifacts
**Then** it identifies and reports optional documents found without requiring them

**Given** validated artifacts
**When** the system ingests them
**Then** it copies the artifacts into the `.startup-factory/artifacts/` directory for agent access

### Story 2.3: State File Management with Atomic Writes

As a system,
I want to track pipeline state in a YAML state file with crash-safe atomic writes,
So that state is never corrupted by unclean exits and partial progress is always preserved.

**Acceptance Criteria:**

**Given** a build is starting with a set of epics and stories
**When** the state manager initializes state
**Then** it creates `state.yaml` with the hierarchical schema: run-level metadata (status, started, config snapshot) and epic-level story entries (status: pending, phase: pending for each story)

**Given** a story completes a pipeline phase
**When** the state manager updates the story
**Then** it writes the updated state using atomic writes (write to `.state.yaml.tmp`, then rename to `state.yaml`)
**And** the story's status, phase, attempts count, and cost are updated

**Given** the process crashes mid-write
**When** the system restarts and reads state
**Then** `state.yaml` contains either the previous complete state or the new complete state, never a partial write

**Given** the state file exists from a previous run
**When** the state manager reads state
**Then** it correctly parses the hierarchical YAML schema and returns typed state objects
**And** it can enumerate stories by status (pending, in-progress, completed, failed)

---

## Epic 3: Core Build Pipeline

Operator can run a full build that dispatches agents through the Story Creator -> Developer -> Code Reviewer -> QA pipeline, producing working code from BMAD artifacts with real-time structured logging.

### Story 3.1: AgentRunner Interface & Claude Agent Runner Implementation

As a system,
I want a provider-agnostic agent execution layer backed by the Claude Agent SDK,
So that agents can be dispatched uniformly and the provider can be swapped in the future.

**Acceptance Criteria:**

**Given** the AgentRunner interface is defined
**When** a component needs to dispatch an agent
**Then** it calls `AgentRunner.run(config: AgentConfig)` and receives a `Promise<AgentResult>`
**And** the interface defines AgentConfig (model, system prompt path, tool permissions, workspace path) and AgentResult (success/failure, output, cost data, error category if failed)

**Given** the ClaudeAgentRunner implementation
**When** `run()` is called with an AgentConfig
**Then** it creates a Claude Agent SDK session with the specified model, system prompt, and tool permissions
**And** the agent executes with access to built-in tools (Read, Write, Edit, Bash, Glob, Grep) as configured

**Given** an agent run completes
**When** the AgentResult is returned
**Then** it includes token usage (input tokens, output tokens), model tier used, and estimated cost

**Given** an API error occurs (rate limit, timeout, network error)
**When** the ClaudeAgentRunner catches it
**Then** it returns an AgentResult with failure status and the appropriate ErrorCategory (Transient for API errors)

### Story 3.2: Story Creator & Developer Agent Configurations

As a system,
I want configured Story Creator and Developer agents with role-specific prompts and tool permissions,
So that stories can be generated from BMAD artifacts and then implemented as working code.

**Acceptance Criteria:**

**Given** the Story Creator agent configuration
**When** the agent is dispatched with BMAD planning artifacts
**Then** it has read-only access to the workspace artifacts directory
**And** it has write access to create story spec files (`stories/{epic}-{story}/spec.md`)
**And** its system prompt instructs it to consume PRD, architecture, epics, and UX specs to produce implementation-ready story specs with clear acceptance criteria

**Given** the Developer agent configuration
**When** the agent is dispatched with a story spec
**Then** it has read access to the workspace (story specs, BMAD artifacts, existing code)
**And** it has write access to the project source code directory
**And** it has Bash access for running build and test commands
**And** its system prompt instructs it to implement the story, write functional code and corresponding tests, and follow the architecture conventions

**Given** either agent's configuration
**When** inspecting the config.ts file
**Then** it specifies the model tier, tool permissions, and retry settings as typed TypeScript objects
**And** the system prompt is stored as a separate prompt.md file loaded at runtime

### Story 3.3: Code Reviewer & QA Agent Configurations

As a system,
I want configured Code Reviewer and QA agents with role-specific prompts and tool permissions,
So that generated code is reviewed for quality and validated against acceptance criteria.

**Acceptance Criteria:**

**Given** the Code Reviewer agent configuration
**When** the agent is dispatched after development
**Then** it has read access to the workspace (story spec, generated code, existing code)
**And** it has write access to create review feedback files (`stories/{epic}-{story}/review.md`)
**And** its system prompt instructs it to review code for quality, correctness, spec adherence, and maintainability
**And** the review output is either an approval or actionable feedback describing what needs to change

**Given** the QA agent configuration
**When** the agent is dispatched after code review approval
**Then** it has read access to the workspace (story spec, generated code, review)
**And** it has Bash access to run tests and validate the application starts
**And** it has write access to create QA reports (`stories/{epic}-{story}/qa-report.md`)
**And** its system prompt instructs it to run tests, validate app behavior against acceptance criteria, and report pass/fail with details

**Given** either agent's configuration
**When** inspecting the config.ts file
**Then** it specifies the model tier, tool permissions, and retry settings as typed TypeScript objects
**And** the system prompt is stored as a separate prompt.md file loaded at runtime

### Story 3.4: Pipeline Dispatcher, Build Command & Structured Logging

As an operator,
I want to run `startup-factory build <artifact-path>` and see real-time progress as agents are dispatched through the pipeline,
So that I can kick off a build and monitor its progress.

**Acceptance Criteria:**

**Given** an operator runs `startup-factory build ./planning-artifacts`
**When** the build command executes
**Then** it validates artifacts (via workspace manager), initializes state, and starts the pipeline dispatcher

**Given** the pipeline dispatcher starts with initialized state
**When** it processes stories
**Then** it reads the state file to find the next pending story
**And** dispatches it sequentially through the pipeline phases: storyCreation -> development -> codeReview -> qa
**And** updates the state file after each phase completes

**Given** a story completes all 4 pipeline phases successfully
**When** the state is updated
**Then** the story status is set to `completed` and the dispatcher moves to the next story

**Given** the pipeline is running
**When** agents are dispatched and complete
**Then** structured log lines are written to stdout: agent dispatched, story started, phase completed, story completed
**And** logs are human-readable by default (e.g., `[22:01:03] Starting story 1-1 with developer agent`)
**And** errors and warnings are written to stderr

**Given** the Code Reviewer agent returns rejection feedback instead of approval
**When** the dispatcher processes the code review result
**Then** the story enters the escalation flow as a Capability error (treated the same as a development phase failure)
**And** the review feedback is preserved in the workspace for context if the story is retried

**Given** the pipeline finishes processing all stories
**When** the build completes
**Then** the dispatcher updates the run status in the state file and exits with the appropriate exit code (0/1/2)

---

## Epic 4: Failure Handling & Recovery

System handles agent failures gracefully with retry, model escalation, and structured failure notes. Operator can selectively retry failed stories without re-running the full pipeline.

### Story 4.1: Failure Notes Module

As a system,
I want to write and read structured failure notes after each failed agent attempt,
So that subsequent retries have context about what went wrong and can try a different approach.

**Acceptance Criteria:**

**Given** an agent run fails
**When** the failure notes module writes a failure note
**Then** it creates a markdown file at `stories/{epic}-{story}/failures/attempt-{n}.md`
**And** the file contains: error category, error message, model tier used, phase that failed, and any agent output before failure

**Given** a story is being retried
**When** the agent is dispatched for the retry
**Then** previous failure notes for that story are readable from the failures directory
**And** the agent's context includes these failure notes so it can learn from previous attempts

**Given** multiple failure attempts for a story
**When** reviewing the failures directory
**Then** each attempt has its own numbered file (attempt-1.md, attempt-2.md, etc.) preserving the full failure history

### Story 4.2: Three-Tier Escalation Logic

As a system,
I want to automatically retry, escalate to a more capable model, or flag for human attention based on error category,
So that failures are resolved autonomously when possible and flagged clearly when not.

**Acceptance Criteria:**

**Given** an agent fails with a Transient error (API timeout, rate limit)
**When** the escalation logic evaluates the failure
**Then** it retries with the same model tier and a fresh agent instance

**Given** an agent fails with a Capability error (agent couldn't complete the task)
**When** the escalation logic evaluates the failure
**Then** it escalates to the next model tier in the configured escalation order
**And** the failure note from the previous attempt is included in the retry context

**Given** an agent fails with a Specification error (ambiguous or conflicting spec)
**When** the escalation logic evaluates the failure
**Then** it flags the story for human attention and sets status to `failed`
**And** the failure note clearly describes the specification issue

**Given** a story has exhausted all retries and escalation tiers
**When** the max attempts are reached
**Then** the story is flagged for human attention with status `failed`
**And** a structured log line is emitted indicating the story requires manual intervention

**Given** a story fails with a System error (orchestrator bug, file I/O error)
**When** the escalation logic evaluates the failure
**Then** the pipeline halts and reports the system error immediately

### Story 4.3: Non-Blocking Execution & Retry Command

As an operator,
I want the pipeline to skip blocked stories and continue with others, and I want to selectively retry failed stories later,
So that one failure doesn't block the entire build and I can address failures incrementally.

**Acceptance Criteria:**

**Given** a story fails and is flagged for human attention
**When** the dispatcher looks for the next story to process
**Then** it skips the failed story and continues with the next pending story that doesn't collide with the failed one

**Given** a completed build with some failed stories
**When** the operator runs `startup-factory retry <story-id>`
**Then** the system loads the existing state file, resets the specified story to pending, and re-runs it through the pipeline from the failed phase
**And** previous failure notes are preserved and available to the retried agent

**Given** an operator retries a story that doesn't exist in the state file
**When** the retry command executes
**Then** it fails with a clear error identifying that the story ID was not found

**Given** an operator retries a story that is already completed
**When** the retry command executes
**Then** it warns the operator that the story already completed and asks for confirmation or exits without action

---

## Epic 5: Cost Tracking & Reporting

Operator can monitor build progress, view cost breakdowns per agent/story/run, and receive clear completion summaries in text, JSON, or YAML format.

### Story 5.1: Cost Tracker

As a system,
I want to log token usage and estimated cost for every agent run and tally cumulative costs,
So that cost data is always available in the state file for reporting.

**Acceptance Criteria:**

**Given** an agent run completes (success or failure)
**When** the cost tracker processes the AgentResult
**Then** it records: input tokens, output tokens, model tier, and estimated cost for that agent run

**Given** cost data for individual agent runs within a story
**When** the cost tracker tallies story cost
**Then** it sums all agent run costs for that story and stores the total in the state file under the story entry

**Given** cost data for all stories in a run
**When** the run completes or status is requested
**Then** the total run cost is computed by summing all story costs
**And** the total is stored in the run-level metadata of the state file

### Story 5.2: Status & Cost Commands

As an operator,
I want to check the current build status and view cost breakdowns from the CLI,
So that I can monitor progress and understand spending.

**Acceptance Criteria:**

**Given** a build is in progress or has completed
**When** the operator runs `startup-factory status`
**Then** it reads the state file and displays: run status, number of stories by status (pending/in-progress/completed/failed), list of failed stories with reasons

**Given** a build is in progress or has completed
**When** the operator runs `startup-factory cost`
**Then** it reads the state file and displays: per-story cost breakdown (model tier, tokens, cost), cumulative run cost total

**Given** no state file exists (no build has been run)
**When** the operator runs `startup-factory status` or `startup-factory cost`
**Then** it displays a clear message that no build data was found

### Story 5.3: Completion Summary & Output Formats

As an operator,
I want to see a clear completion summary when a build finishes, with the option to get it in JSON or YAML format,
So that I can quickly understand results and pipe output to other tools.

**Acceptance Criteria:**

**Given** a build completes (full success, partial success, or total failure)
**When** the completion summary is generated
**Then** it displays to stdout: total stories completed/failed, test results summary, total cost, and list of any failed stories with failure reasons

**Given** the operator passes `--output json` flag to the build command
**When** the completion summary is generated
**Then** the summary is output as a valid JSON object to stdout instead of human-readable text

**Given** the operator passes `--output yaml` flag to the build command
**When** the completion summary is generated
**Then** the summary is output as valid YAML to stdout instead of human-readable text

**Given** default execution (no --output flag)
**When** the completion summary is generated
**Then** the summary is displayed as formatted, human-readable text with clear section headers
