---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments:
  - docs/planning-artifacts/product-brief-startup-factory-2026-03-05.md
  - docs/brainstorming/brainstorming-session-2026-03-05-2345.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
  projectContext: 0
workflowType: 'prd'
classification:
  projectType: cli_tool
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - startup-factory

**Author:** Ty
**Date:** 2026-03-05

## Executive Summary

Startup Factory democratizes software creation by enabling anyone with a product idea to autonomously generate a production-grade, tested, deployable MVP — without writing code, hiring developers, or piloting AI tools. Users provide structured BMAD planning artifacts, kick off a CLI build job, and receive a working codebase with passing tests. The system targets non-technical solo founders who are blocked by the cost and time required to turn ideas into software. One-liner: kick off your startup idea, go to bed, and wake up with a fully ready, tested, deployable MVP.

### What Makes This Special

Startup Factory is not a copilot — it's an autopilot. While AI coding assistants (Cursor, Copilot, ChatGPT) accelerate developers, they still require a technically skilled human to steer. Startup Factory removes the human from the implementation loop entirely. This is possible because of two compounding insights: (1) structured BMAD planning artifacts provide agents with well-defined specifications that eliminate ambiguity, solving the "garbage in, garbage out" problem; and (2) a purpose-built multi-agent orchestration harness with quality gates, failure escalation, and non-blocking execution ensures reliability without human oversight. The result is a system where structure enables autonomy.

## Project Classification

- **Project Type:** CLI tool — batch orchestrator dispatching specialist agents via terminal
- **Domain:** General (AI/developer tooling)
- **Complexity:** Medium — no regulatory concerns, but multi-agent orchestration, failure handling, and autonomous code generation present significant technical challenges
- **Project Context:** Greenfield

## Success Criteria

### User Success

- **Primary success:** User kicks off a build job and wakes up to a codebase where tests pass, the app starts, and all acceptance criteria from the spec are met
- **Partial success is valid:** If 8 out of 10 stories complete but 2 get stuck and are flagged, the user still has a substantially useful outcome. The system communicates clearly what completed and what needs attention
- **Zero technical skill required:** User's only interaction is providing BMAD planning artifacts and running a CLI command

### Business Success

N/A for MVP. This is a personal-use tool first. Business metrics will only be defined if the tool proves effective for the creator's own projects.

### Technical Success

- **Code quality:** Functional and maintainable — clean enough to build on, not optimized for elegance
- **Failure escalation resolution:** 80% of agent failures resolved autonomously through the three-tier escalation ladder (retry → smarter model → flag human)
- **Non-blocking orchestration:** When a story is blocked, the pipeline continues with non-colliding stories rather than halting
- **Cost visibility:** Every agent run logs token usage, model tier, and estimated cost. Per-story and cumulative totals visible in CLI output

### Measurable Outcomes

| Outcome | Target |
|---------|--------|
| Build success rate (all stories complete) | 80%+ |
| Spec fidelity (acceptance criteria met) | 100% of completed stories |
| Failure escalation self-resolution | 80% without human intervention |
| Overnight completion (simple MVPs) | < 12 hours |
| Code quality | Functional, maintainable, tests passing |
| Partial success utility | Usable output even when some stories fail |

## Product Scope & Development Strategy

### MVP Strategy

**MVP Approach:** Problem-solving MVP — prove the core autonomous pipeline works. The single validation question: can a 4-agent pipeline autonomously produce a working codebase from BMAD planning artifacts?

**Resource Requirements:** Solo developer (Ty) building the orchestration harness and agent configurations. The agents themselves are LLM-powered — the engineering work is the harness, not the AI.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1 (Happy Path): Full autonomous build from BMAD artifacts to passing codebase
- Journey 2 (Partial Success): Clear failure reporting, selective retry, partial output utility
- Journey 3 (Operator): Config tuning, real-time monitoring, cost visibility

**Must-Have Capabilities:**
- Lean batch CLI orchestrator with event-triggered dispatch and non-blocking execution
- Agent workspace with filesystem-as-protocol for inter-agent communication
- Core 4-agent pipeline: Story Creator → Developer → Code Reviewer → QA/Test
- Three-tier failure escalation (retry → smarter model → flag human) with failure notes in workspace
- BMAD planning artifact ingestion (PRD, architecture, epics, UX specs)
- YAML config file with CLI flag overrides
- Basic cost tracking (per-agent, per-story, cumulative)
- Structured log output + completion summary (YAML/JSON)
- Selective story retry
- Meaningful exit codes
- Output: build-ready, test-passing codebase (no automated deployment)

### Phase 2: Resilience

- Cost circuit breaker (hard spending limits)
- Git branch per story isolation
- Agent heartbeat and crash detection
- API failover across providers
- Shell completion

### Phase 3: Intelligence

- Independent QA test generation
- Cross-agent interpretation checks
- Scrum Master agent for strategic decisions
- Loop detection and failure pattern analysis
- Cost-aware model selection

### Phase 4: Maturity

- Architecture health checks and convention enforcement
- Context-window-aware story sizing
- Progressive checkpoint protocol
- Continuous-mode orchestrator
- BMAD Phase 1-3 planning integration
- Automated deployment

### Risk Mitigation

**Technical Risks:**
- *Developer agent code quality:* Biggest risk. Mitigated by Code Reviewer + QA agents as quality gates, plus three-tier escalation to more capable models. Partial success (most stories working) is an acceptable outcome.
- *LLM capability ceiling:* If current models can't reliably produce production-grade code, the escalation ladder provides graceful degradation. Partial success is still valuable.
- *Agent context window limits:* Stories must fit in a single context window. Mitigated by BMAD's existing story sizing conventions. Context-window-aware sizing deferred to Phase 4.
- *Inter-agent coordination failures:* Mitigated by filesystem-as-protocol (simple, debuggable) and structured state file as single source of truth.
- *Spec quality bottleneck:* If BMAD artifacts aren't structured enough for agents, the bottleneck is input quality, not system architecture. BMAD methodology can be refined independently.
- *Cost unpredictability:* Basic cost tracking in MVP, with circuit breaker planned for Phase 2.

**Market Risks:**
- N/A for personal use. Validation is binary: does the pipeline produce working code from Ty's own BMAD projects?

**Resource Risks:**
- Solo developer. If scope proves too large, the modular agent roster allows shipping with fewer agents initially (e.g., skip Code Reviewer, rely on QA alone).

## User Journeys

### Journey 1: Alex — The Overnight MVP (Happy Path)

Alex has spent three months refining a product idea for a niche project management tool for freelance photographers. After going through the BMAD planning process, Alex has a PRD, architecture doc, UX specs, and an epics/stories breakdown. Alex has gotten quotes from two dev shops — $45k and $62k — and can't stomach either.

Alex discovers Startup Factory. That evening, Alex points the CLI at the BMAD planning artifacts folder and runs the build command. The terminal lights up — agents dispatching, stories being created, code being written. Alex watches for a few minutes, sees the first story complete with tests passing, and decides to trust the process. Goes to bed.

7:30 AM. Alex checks the terminal over coffee. The status summary shows: 10/10 stories completed, all tests passing, build successful. Alex runs the app locally — it starts up, the UI matches the UX spec, the core workflows function as designed. Alex spends the morning showing it to two photographer friends. By lunch, both want to sign up.

**Capabilities revealed:** CLI build command, BMAD artifact ingestion, real-time terminal output, status summary on completion, all-stories-pass reporting.

### Journey 2: Alex — The Partial Success (Edge Case)

Same setup. Alex kicks off the build and goes to bed. Morning: the terminal summary shows 8/10 stories completed, 2 stories failed. The summary clearly lists which stories succeeded, which failed, and why — one hit a third-party API integration that the agent couldn't resolve, one had a vague acceptance criterion that caused conflicting interpretations.

Alex reads the failure notes in the workspace directory for more detail. The failed stories are clearly flagged in the state file. Alex tweaks the acceptance criteria on the vague story, adds a note about the API integration approach, and re-runs the build targeting only the 2 failed stories. One completes. The other fails again — Alex flags it for manual handling later and ships the MVP with 9/10 features working.

**Capabilities revealed:** Clear failure reporting (terminal + state file), failure notes in workspace, per-story re-run capability, spec tweaking and retry workflow, partial-success as valid outcome, ability to flag and skip stories.

### Journey 3: Ty — The Operator (System Administration)

Ty is setting up Startup Factory for a new project. He creates a config YAML specifying model preferences, cost thresholds, and escalation behavior. He also overrides the default retry count via CLI flag for this particular run because the project is complex and he wants more patience on failures.

During the build, Ty monitors real-time terminal output — watching agents dispatch, stories progress, and occasional escalations from Haiku to Sonnet. He notices one story is cycling through retries. The terminal shows the escalation ladder in action: fresh retry, then model upgrade, then the story gets flagged and skipped. The pipeline continues with remaining stories without missing a beat.

After the run, Ty checks the state file for the full cost breakdown — per-story token usage, model tiers used, total spend. He adjusts the config for the next run based on what he learned.

**Capabilities revealed:** YAML config file, CLI flag overrides, real-time terminal monitoring, escalation visibility, non-blocking pipeline continuation, cost breakdown in state file, iterative config tuning.

### Journey Requirements Summary

| Capability | Revealed By |
|-----------|-------------|
| CLI build command with artifact path | Journey 1 |
| BMAD artifact ingestion and validation | Journey 1 |
| Real-time terminal output during build | Journey 1, 3 |
| Completion status summary | Journey 1, 2 |
| Clear failure reporting with reasons | Journey 2 |
| Failure notes in workspace directory | Journey 2 |
| Per-story re-run / selective retry | Journey 2 |
| Partial success handling | Journey 2 |
| YAML config file | Journey 3 |
| CLI flag overrides | Journey 3 |
| Escalation ladder visibility | Journey 3 |
| Non-blocking story execution | Journey 2, 3 |
| Cost tracking and breakdown | Journey 3 |

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Autonomous multi-agent code generation pipeline:** No existing tool chains structured planning artifacts through a full Story Creator → Developer → Code Reviewer → QA pipeline without human involvement. Current AI coding tools are copilots; this is an autopilot.
- **Structure-enables-autonomy paradigm:** Well-structured BMAD planning artifacts eliminate the ambiguity that causes AI coding tools to fail. This is not "better prompting" — it's a fundamentally different input contract.
- **Filesystem-as-protocol for agent coordination:** Workspace directories and state files as the inter-agent communication layer, rather than custom message buses or APIs. Git and files are the infrastructure.
- **Failure as institutional knowledge:** Failed agents write structured failure notes that inform subsequent attempts. Most retry systems are stateless; this one learns.

### Market Context & Competitive Landscape

- **AI coding assistants (Cursor, Copilot, Windsurf):** Accelerate developers but require human pilots. Not competitors — different category.
- **No-code platforms (Bubble, Webflow):** Limited flexibility, platform lock-in. Different approach entirely.
- **AI app builders (v0, Bolt, Lovable):** Generate single-page apps or prototypes, not production-grade MVPs from structured specs. Closest competitors but significantly narrower scope.
- **Dev shops / freelancers:** Expensive, slow, human-dependent. The incumbent being disrupted.

### Validation Approach

- **Proof of concept:** Run the pipeline against a real BMAD-planned project and measure: do tests pass? Does the app match the spec? How many stories complete autonomously?
- **Iterate on failure modes:** Each failed run reveals where the pipeline breaks — agent capability gaps, spec ambiguity, or orchestration bugs. Fix and re-run.
- **Success rate tracking:** Target 80%+ build success rate as the validation threshold.

## CLI Tool Specific Requirements

### Project-Type Overview

Startup Factory is a batch-mode CLI orchestrator — scriptable-first, designed to run autonomously without interactive input. Users invoke a build command, point it at BMAD planning artifacts, and the system runs to completion. Real-time structured output is available for monitoring but not required for operation.

### Command Structure

- **Primary command:** `startup-factory build <artifact-path>` — kicks off the full pipeline
- **Selective retry:** `startup-factory retry <story-id>` — re-run specific failed stories
- **Status check:** `startup-factory status` — read current state file and display summary
- **Cost report:** `startup-factory cost` — display cost breakdown from last/current run

### Output Formats

- **During execution:** Structured log lines to stdout — agent dispatched, story started, story completed, escalation triggered, story failed. Parseable and human-readable.
- **Completion summary:** Terminal summary of results (stories completed/failed, tests passed, cost). Available as YAML or JSON via flag (e.g., `--output json`)
- **State file:** YAML state file in workspace as persistent, machine-readable record of run status
- **Failure notes:** Markdown files in workspace directory per failed story with structured failure details

### Config Schema

- **Location:** `startup-factory.yaml` in project root
- **Precedence:** CLI flags override config file values
- **Key config options:**
  - `models.default` — default model tier for agents
  - `models.escalation` — ordered list of model tiers for escalation ladder
  - `retry.max_attempts` — max retries before flagging human (default: 3)
  - `artifacts_path` — path to BMAD planning artifacts
  - `workspace_path` — path to agent workspace directory
  - `cost.tracking` — enable/disable cost logging

### Implementation Considerations

- **No interactive prompts:** The CLI must never block waiting for user input during a build run. All configuration is provided upfront via config file and CLI flags.
- **Exit codes:** Meaningful exit codes — 0 for full success, 1 for partial success (some stories failed), 2 for total failure, so the tool integrates with scripts and CI pipelines.
- **Stdout vs stderr:** Structured progress to stdout, errors/warnings to stderr. Allows piping output to files or other tools.
- **Shell completion:** Deferred to post-MVP.

## Functional Requirements

### Build Orchestration

- FR1: Operator can initiate a full build pipeline by specifying a path to BMAD planning artifacts
- FR2: System can read and validate BMAD planning artifacts (PRD, architecture doc, epics/stories, UX specs) as input
- FR3: System can dispatch agents sequentially through the Story Creator → Developer → Code Reviewer → QA pipeline
- FR4: System can detect when a story is blocked and skip it to continue with non-colliding stories
- FR5: System can track pipeline state in a structured YAML state file as single source of truth
- FR6: System can execute the full pipeline without interactive user input (batch mode)

### Failure Handling & Escalation

- FR7: System can retry a failed agent run with a fresh agent instance
- FR8: System can escalate a failed story to a more capable model tier
- FR9: System can flag a story for human attention after exhausting escalation options
- FR10: System can write structured failure notes to the workspace directory after each failed attempt
- FR11: System can use failure notes from previous attempts to inform subsequent retry attempts
- FR12: Operator can selectively re-run specific failed stories without re-running the full pipeline

### Agent Workspace

- FR13: System can maintain a shared workspace directory for inter-agent communication
- FR14: Agents can read context from the workspace and state file (pull-based)
- FR15: Agents can write outputs and artifacts to the workspace directory
- FR16: System can store failure notes, agent outputs, and handoff artifacts in the workspace

### Story Creation

- FR17: Story Creator agent can consume BMAD planning artifacts and generate implementation-ready story specs
- FR18: Story Creator agent can produce story specs with clear acceptance criteria

### Development

- FR19: Developer agent can implement a story based on its story spec
- FR20: Developer agent can write functional code and corresponding tests
- FR21: Developer agent can read and incorporate context from the workspace

### Code Review

- FR22: Code Reviewer agent can review generated code for quality, correctness, and spec adherence
- FR23: Code Reviewer agent can provide actionable feedback when code does not meet standards
- FR24: Code Reviewer agent can approve code that meets functional and maintainability standards

### QA & Testing

- FR25: QA agent can run tests and validate that the application starts
- FR26: QA agent can validate app behavior against story spec acceptance criteria
- FR27: QA agent can report test results (pass/fail) with details per story

### Configuration

- FR28: Operator can configure system behavior via a YAML config file in the project root
- FR29: Operator can override config values via CLI flags (flags take precedence)
- FR30: Operator can configure default model tier and escalation model order
- FR31: Operator can configure max retry attempts before human flagging

### Cost Tracking

- FR32: System can log token usage, model tier used, and estimated cost per agent run
- FR33: System can tally cumulative cost per story and per full build run
- FR34: Operator can view cost breakdown in CLI output and state file

### CLI Interface

- FR35: Operator can run a build command targeting a BMAD artifacts path
- FR36: Operator can run a retry command targeting specific failed stories
- FR37: Operator can run a status command to view current/last run state
- FR38: Operator can run a cost command to view cost breakdown
- FR39: System can output structured log lines to stdout during execution (agent dispatch, story progress, escalations, failures)
- FR40: System can output a completion summary to stdout with stories completed/failed, tests passed, and cost
- FR41: Operator can request completion summary in YAML or JSON format via CLI flag
- FR42: System can return meaningful exit codes (0 = full success, 1 = partial success, 2 = total failure)

## Non-Functional Requirements

### Performance

- Build pipeline throughput must support completing a simple MVP (10-15 stories) within 12 hours
- Individual agent dispatch overhead (orchestrator processing between agent runs) must be negligible — under 5 seconds
- State file reads/writes must not bottleneck the pipeline
- Real-time terminal output must not lag behind actual agent progress by more than a few seconds

### Security

- LLM provider API keys must be stored securely — environment variables or config file excluded from version control, never logged to stdout or state files
- Generated code must not contain hardcoded secrets or credentials
- Workspace directory may contain sensitive project artifacts — no remote transmission of workspace contents beyond LLM API calls necessary for agent execution

### Integration

- Must support Anthropic API as primary LLM provider
- Architecture must allow adding additional LLM providers (OpenAI, etc.) for escalation and failover in post-MVP phases
- Must handle LLM API rate limits gracefully — backoff and retry without crashing
- Must handle LLM API timeouts and transient errors without pipeline failure

### Reliability

- Pipeline must run unattended for up to 12 hours without crashing
- Unclean exits (process kill, system restart) must not corrupt the state file — state must be recoverable
- Partial progress must be preserved — if the process dies after 7 stories complete, those 7 stories' work is retained
- Orchestrator must handle individual agent failures without pipeline-level crashes (agent failure ≠ system failure)
