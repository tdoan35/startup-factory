---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Automating BMAD Phase 4 (implementation) via autonomous agents - Startup Factory'
session_goals: 'Ideas for agent architecture, orchestration, quality control, and workflow automation to reliably turn BMAD planning/solutioning artifacts into working code'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Morphological Analysis', 'Chaos Engineering']
ideas_generated: [36]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Ty
**Date:** 2026-03-05

## Session Overview

**Topic:** Automating BMAD Phase 4 (implementation) via autonomous agents - "Startup Factory"
**Goals:** Ideas for agent architecture, orchestration, quality control, and workflow automation that can reliably turn BMAD Phase 1-3 outputs (implementation & planning artifacts) into working code without manual human-in-the-loop cycling.

### Context Guidance

_The BMAD-METHOD Phase 4 currently relies on a human developer using coding agent skills: `/create-story` to generate story specs, `/dev-story` to implement them, and `/code-review` to validate. The goal is to replace this manual loop with autonomous agents._

### Session Setup

_Session initialized with focus on agent automation of the create-story, dev-story, code-review pipeline. Key areas to explore include agent architecture, orchestration patterns, quality gates, error recovery, and the boundary between full autonomy and human oversight._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Automating BMAD Phase 4 with focus on agent architecture and orchestration

**Recommended Techniques:**

- **Question Storming:** Map the problem space — what "done" means, implicit knowledge, agent tooling needs
- **Morphological Analysis:** Systematically explore architectural parameters and their combinations
- **Chaos Engineering:** Stress-test the architecture against failure scenarios

**AI Rationale:** The topic requires deep systems thinking (Question Storming to map unknowns), multi-parameter design decisions (Morphological Analysis for architecture), and robustness validation (Chaos Engineering for a system that writes production code autonomously).

## Technique Execution Results

### Question Storming

**Interactive Focus:** Mapped critical unknowns across the autonomous implementation problem space
**Key Questions Explored:**
- What does "done" mean without a human in the loop?
- Can agents QA their own output? (Self-assessment blind spots)
- Should there be a design spec to compare against?
- How do we know a story has fully captured everything?
- Could we reach a fully complete state with enough spec docs?
- Would agents need additional tools like browser usage?
- Are Phase 1-3 artifacts structured well enough for agent consumption?
- What implicit developer knowledge never makes it into specs?

**Key Breakthroughs:** The distinction between mechanical verification (tests pass) and judgment-based verification (solves the right problem). The question of whether the bottleneck is agent capability or input artifact quality.

### Morphological Analysis

**Parameter Matrix Explored:**

| Parameter | Design Decision |
|-----------|----------------|
| Orchestration | Lean hub-and-spoke dispatcher |
| Memory/Context | Pull-based, structured state file + freeform workspace |
| Agent Roster | 4 core (Story Creator, Developer, Code Reviewer, QA/Test) + optional specialists |
| Failure Handling | Retry fresh -> smarter model -> human notification |
| Human Interface | CLI-first, state file as shared interface, human override |
| Execution Model | Batch CLI for MVP, continuous-ready architecture |

**Ideas Generated:**

**[Architecture #5]**: Hub-and-Spoke Orchestrator with Persistent Workspace
_Concept_: Central orchestrator dispatches specialist agents that read/write to a shared "agent workspace" directory committed to the repo. Filesystem as inter-agent communication protocol.
_Novelty_: No custom message bus — just files and git.

**[Architecture #6]**: Pull-Based Context with Lean Orchestrator
_Concept_: Orchestrator maintains minimal state — a dispatcher that knows what to do next. Specialists pull their own context from workspace and state files.
_Novelty_: Resists making the orchestrator all-knowing. Trusts specialists.

**[Architecture #7]**: Structured State + Freeform Workspace Hybrid
_Concept_: Sprint-status.yaml-style state file for coordination. Separate workspace directory for richer handoff artifacts.
_Novelty_: Two-tier information architecture — structured for coordination, freeform for collaboration.

**[Architecture #8]**: Modular Agent Roster with Optional Specialists
_Concept_: Core pipeline: Story Creator -> Developer -> Code Reviewer -> QA/Test. Optional agents (Story Validator, Architecture Guard, Integration Agent, Scrum Master) enabled based on project complexity.
_Novelty_: Plugin-style roster — configure the agent team like assembling a squad.

**[Architecture #9]**: QA/Test Agent as Essential Gate
_Concept_: QA agent is non-optional — runs the app, executes tests, uses browser automation to verify behavior matches spec. Code review checks code quality; QA checks the product.
_Novelty_: Separates "is the code good" from "does it work."

**[Architecture #10]**: Three-Tier Escalation Ladder
_Concept_: First failure: retry with fresh agent. Second: escalate to more capable model (Haiku -> Sonnet -> Opus). Third: flag for human, pause story, continue non-colliding work.
_Novelty_: Uses model tiers as built-in escalation resource.

**[Architecture #11]**: Failure-Aware Workspace Protocol
_Concept_: Failed agents write structured failure notes to workspace. Next agent reads these to avoid same mistakes. Failure becomes institutional knowledge.
_Novelty_: Most retry systems are stateless — this one learns from each attempt.

**[Architecture #12]**: Non-Blocking Orchestration on Failure
_Concept_: When a story is blocked, orchestrator checks for non-colliding stories and continues. BMAD's epic design principle of non-collision makes this safe.
_Novelty_: Blocked story becomes background concern, not pipeline halt.

**[Architecture #13]**: Integration Regression Detection
_Concept_: After each story, QA runs full regression suite. If Story 3 breaks Story 1, QA flags it and orchestrator creates a hotfix micro-story with priority.
_Novelty_: Treats regressions as natural byproduct with systematic response.

**[Architecture #14]**: Scrum Master Agent as Strategic Decision-Maker
_Concept_: Dedicated SM agent handles sprint-level decisions — reordering backlog, assessing risk, deciding whether to pause related stories. Orchestrator detects triggers and dispatches SM.
_Novelty_: Mirrors real team structure. Clean separation of tactical execution from strategic judgment.

**[Architecture #15]**: Event-Triggered Agent Dispatch Pattern
_Concept_: Orchestrator operates as simple event loop — reads state file, detects status changes and flags, dispatches appropriate specialist. Almost stateless router.
_Novelty_: All intelligence lives in the specialists, not the orchestrator.

**[Architecture #16]**: CLI-First Human Interface
_Concept_: System communicates through CLI notifications and state file flags. Humans respond through CLI. State file is single source of truth for both agents and humans.
_Novelty_: No separate UI layer for v1. Workspace and state file ARE the interface.

**[Architecture #17]**: Human Override Protocol
_Concept_: Humans can override any agent decision via CLI or state file edits — skip stories, reorder backlog, force-escalate, inject new stories. Human edits treated as highest-priority events.
_Novelty_: Human is a participant with root access, not an external observer.

**[Architecture #18]**: Batch-Mode MVP with Continuous-Ready Design
_Concept_: MVP runs as CLI command — read state, dispatch agent(s), wait, update state, report, exit. Internal architecture (event loop, state file, pull-based context) designed so wrapping in a long-running process later is just a loop. Zero rewrite to upgrade.
_Novelty_: MVP is the inner loop of the eventual continuous system.

### Chaos Engineering

**Scenarios Tested and Defenses Designed:**

**[Chaos #19]**: Independent Test Generation
_Concept_: QA agent writes its own tests from the story spec, independent of dev agent's tests. Runs both. Disagreement between test suites signals misunderstanding.
_Novelty_: Two independent spec interpretations — disagreement is a feature.

**[Chaos #20]**: Spec-Driven Behavioral Assertions
_Concept_: QA generates behavioral assertions directly from acceptance criteria. Browser-automated checks that are unfakeable — behavior matches spec or it doesn't.
_Novelty_: Ties QA to source of truth rather than any agent's interpretation.

**[Chaos #21]**: Periodic Architecture Health Check
_Concept_: After every 3-5 stories (or per epic), Architecture Guard scans codebase against Phase 3 architecture doc. Produces health report. SM decides on refactoring micro-stories if needed.
_Novelty_: Health checkup rather than per-story gate. Pragmatic, not bureaucratic.

**[Chaos #22]**: Architecture Guard as Convention Enforcer
_Concept_: Architecture Guard maintains a living "conventions file" in workspace — patterns, naming conventions, file structure rules. Dev agent pulls this before writing code. Guard updates it after each epic.
_Novelty_: Lightweight prevention via pull-based conventions. Fits existing architecture.

**[Chaos #23]**: Workspace as External Memory
_Concept_: Agents write progress checkpoints as they work. If context compacts, they re-read checkpoints to recover. Workspace is "disk," context window is "RAM."
_Novelty_: Context window limits become normal operating condition, not failure mode.

**[Chaos #24]**: Context-Window-Aware Story Sizing
_Concept_: Scrum Master enforces story size heuristic — if a story exceeds file/doc/criteria thresholds, it gets decomposed with explicit dependencies. Sizing constraint is "can an agent hold this in one context window."
_Novelty_: Story sizing reframed around agent capabilities, not human sprint velocity.

**[Chaos #25]**: Progressive Checkpoint Protocol
_Concept_: Dev agent writes structured checkpoint after each discrete piece of work. On failure/restart, orchestrator restarts agent with checkpoint as input. Pick up where left off.
_Novelty_: Save points. Failure at step 8 doesn't redo steps 1-7.

**[Chaos #26]**: Loop Detection via Failure Pattern Analysis
_Concept_: Orchestrator tracks failure types, not just counts. Same story with 3+ cycles of different failure reasons = story is too tangled, not agent incapability. Escalate to SM for decomposition instead of smarter model.
_Novelty_: Distinguishes capability failures from scoping failures.

**[Chaos #27]**: Architecture Guard Catches Structural Misalignment
_Concept_: Guard cross-references implementation against architecture spec for structural facts — wrong tables, wrong endpoints, misnamed fields.
_Novelty_: Expands guard from style cop to structural fact-checker.

**[Chaos #28]**: QA Agent as Spec-to-Reality Validator
_Concept_: QA tests against story spec acceptance criteria, not just code tests. Tests outcomes, not code. Only agent that catches silent corruption.
_Novelty_: "Does the product behave as specified" vs. "does the code work."

**[Chaos #29]**: Cross-Agent Interpretation Check
_Concept_: Before dev begins, Story Creator and Dev agent both independently summarize their understanding of key technical decisions. Written to workspace. Disagreement caught before any code is written.
_Novelty_: Pre-flight checklist. Catches misunderstandings at cheapest possible moment.

**[Chaos #30]**: Agent Heartbeat and Unclean Exit Detection
_Concept_: Orchestrator writes status: running with timestamp when dispatching. Agent updates periodically. Stale running status = unclean exit, recovery needed.
_Novelty_: File-based health monitoring. No infrastructure — just timestamps in existing state file.

**[Chaos #31]**: Git Branch as Safety Net
_Concept_: Each agent works on a per-story branch. If agent dies mid-run, partial work is isolated. Recovery: check git status, roll back or dispatch fresh agent with checkpoint notes.
_Novelty_: Git's existing safety mechanisms as sandbox. No custom rollback logic.

**[Chaos #32]**: Retry with API Failover
_Concept_: If primary model API is down, fall back to alternative provider. Separate "escalate for capability" from "failover for availability."
_Novelty_: Two different reasons to switch models, two different strategies.

**[Chaos #33]**: Cost Tracking in State File
_Concept_: Each agent run logs token usage, model used, estimated cost to state file. Orchestrator tallies per-story and per-sprint cumulative cost.
_Novelty_: Cost as first-class metric alongside story completion.

**[Chaos #34]**: Cost Circuit Breaker
_Concept_: Orchestrator checks cumulative cost against configurable thresholds (per-story, per-sprint, hard ceiling) before dispatching. Threshold hit = pause, flag human, report status.
_Novelty_: Cost treated as system resource with hard limits, like disk space.

**[Chaos #35]**: Cost-Aware Model Selection
_Concept_: Use story complexity signals (files touched, criteria count, dependencies) to pick the right model tier upfront. Trivial story gets Haiku. Complex story gets Sonnet from the start. Avoid wasting a failed cheap attempt.
_Novelty_: Smarter initial selection reduces total cost by avoiding predictable failures.

**[Chaos #36]**: Spend-Per-Story Visibility in CLI
_Concept_: CLI status report includes cost breakdown — per story, per attempt, sprint total vs. budget. Immediate visibility.
_Novelty_: Real-time cost transparency. No surprise bills.

### Creative Facilitation Narrative

_This session moved naturally from mapping unknowns (Question Storming) through systematic architecture design (Morphological Analysis) to adversarial stress-testing (Chaos Engineering). Ty demonstrated strong architectural instincts throughout — particularly the lean orchestrator principle, the separation of strategic decisions (Scrum Master) from tactical execution (orchestrator), and the insight that story sizing should be constrained by agent context windows rather than human sprint velocity. The chaos scenarios revealed important nuances: not all failures are capability failures (some are scoping failures), cost needs circuit breakers just like retry counts, and silent corruption requires both preventive (cross-agent interpretation checks) and detective (spec-driven behavioral QA) defenses._

### Session Highlights

**User Creative Strengths:** Strong systems thinking, clean separation of concerns, pragmatic MVP-first mentality
**AI Facilitation Approach:** Built on user's architectural instincts, pushed into adversarial scenarios to stress-test designs
**Breakthrough Moments:** Context-window-aware story sizing, distinguishing capability vs. scoping failures, cost as first-class resource
**Energy Flow:** Focused and productive throughout, with natural depth on coordination and failure handling topics

## Idea Organization and Prioritization

### Thematic Organization

**Theme 1: Core Architecture & Orchestration** — System structure and agent coordination
- #5 Hub-and-Spoke with Persistent Workspace
- #6 Pull-Based Context with Lean Orchestrator
- #7 Structured State + Freeform Workspace Hybrid
- #8 Modular Agent Roster (4 core + optional specialists)
- #14 Scrum Master as Strategic Decision-Maker
- #15 Event-Triggered Dispatch Pattern
- #18 Batch-Mode MVP, Continuous-Ready

**Theme 2: Quality Assurance & Verification** — Ensuring correctness at every level
- #9 QA/Test Agent as Essential Gate
- #19 Independent Test Generation
- #20 Spec-Driven Behavioral Assertions
- #28 QA as Spec-to-Reality Validator
- #29 Cross-Agent Interpretation Check

**Theme 3: Failure Handling & Resilience** — Graceful failure response
- #10 Three-Tier Escalation Ladder
- #11 Failure-Aware Workspace Protocol
- #12 Non-Blocking Orchestration
- #13 Integration Regression Detection
- #26 Loop Detection via Failure Pattern Analysis
- #30 Agent Heartbeat & Unclean Exit Detection
- #31 Git Branch as Safety Net
- #32 API Failover

**Theme 4: Agent Memory & Context Management** — Knowledge persistence and limitations
- #23 Workspace as External Memory
- #24 Context-Window-Aware Story Sizing
- #25 Progressive Checkpoint Protocol

**Theme 5: Architecture Integrity** — Codebase coherence over time
- #21 Periodic Architecture Health Check
- #22 Convention Enforcer File
- #27 Structural Fact-Checking

**Theme 6: Cost & Operational Control** — Resource management and visibility
- #33 Cost Tracking in State File
- #34 Cost Circuit Breaker
- #35 Cost-Aware Model Selection
- #36 Spend-Per-Story CLI Visibility

**Theme 7: Human Interface & Control** — Human governance of the system
- #16 CLI-First Interface
- #17 Human Override Protocol

### Prioritization Results

**Top 3 High-Impact Ideas:**
1. **#6 Pull-Based Context with Lean Orchestrator** — Foundational design decision. Everything depends on getting the orchestrator right.
2. **#9 QA/Test Agent as Essential Gate** — Quality floor. The only agent testing reality, not interpretation.
3. **#10 Escalation Ladder + #34 Cost Circuit Breaker** (paired) — Controlled autonomy. Handles failures without runaway spending.

**Quick Win Opportunities:**
1. **#7 Structured State File + Workspace** — Just files and directories. Define the schema and structure quickly.
2. **#18 Batch-Mode MVP** — Single CLI command: read state, dispatch one agent, update state, exit.
3. **#33 Cost Tracking** — Log token counts after each agent run. Immediate visibility.

**Breakthrough Concepts:**
1. **#24 Context-Window-Aware Story Sizing** — Novel principle: size stories for agent capability, not human velocity.
2. **#29 Cross-Agent Interpretation Check** — Two agents confirm understanding before work begins. Cheap, preventive, elegant.
3. **#19 Independent Test Generation** — Two independent spec interpretations. Real confidence in autonomous output.

### Action Planning — Implementation Phases

**Phase 1: Foundation (MVP)**
- State file schema + workspace directory structure (#7)
- Lean orchestrator as batch CLI (#6, #18)
- Core pipeline: Story Creator -> Developer -> Code Reviewer -> QA (#8, #9)
- Basic cost tracking (#33)

**Phase 2: Resilience**
- Three-tier escalation ladder (#10)
- Failure notes in workspace (#11)
- Git branch per story (#31)
- Cost circuit breaker (#34)
- Heartbeat / unclean exit detection (#30)

**Phase 3: Intelligence**
- Independent QA test generation (#19)
- Cross-agent interpretation check (#29)
- Loop detection / failure pattern analysis (#26)
- Scrum Master agent for reordering (#14)
- Cost-aware model selection (#35)

**Phase 4: Maturity**
- Periodic architecture health checks (#21, #22)
- Context-window-aware story sizing (#24)
- Progressive checkpoint protocol (#25)
- Non-blocking parallel story execution (#12)
- Continuous-mode orchestrator (wrap the batch loop)

## Session Summary and Insights

**Key Achievements:**
- 36 ideas generated across 7 thematic areas
- Complete architectural blueprint for Startup Factory agent system
- 4-phase implementation roadmap from MVP to maturity
- Critical failure modes identified and defenses designed

**Core Design Principles Established:**
1. Lean orchestrator — dispatcher, not decision-maker
2. Pull-based context — specialists gather their own context
3. Filesystem as protocol — workspace and state files, no custom infrastructure
4. QA as reality check — test outcomes, not code
5. Cost as first-class resource — track, limit, optimize
6. Failures are learning — write notes, inform next attempt
7. Story sizing for agents — context windows, not sprints

**Session Reflections:**
This session moved from problem mapping through systematic architecture design to adversarial stress-testing. The resulting design is grounded in pragmatic principles: separation of concerns, progressive complexity, and building for the constraints of LLM agents rather than fighting them. Each implementation phase delivers standalone value while building toward a fully autonomous development pipeline.
