---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/brainstorming/brainstorming-session-2026-03-05-2345.md
date: 2026-03-05
author: Ty
---

# Product Brief: startup-factory

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Startup Factory is an autonomous agent system that turns product specifications into deployed, functional MVPs — without human intervention. Startup founders describe their product vision, kick off a job, and wake up to working software. By combining a structured planning methodology (BMAD) with a multi-agent architecture featuring quality gates, failure recovery, and architectural integrity checks, Startup Factory eliminates the time, cost, and complexity barriers that prevent founders from bringing their ideas to life.

---

## Core Vision

### Problem Statement

Startup founders have product ideas but face massive barriers turning them into working software. Building an MVP today requires either months of self-taught coding, tens of thousands of dollars hiring developers, or accepting the severe limitations of no-code platforms. Each path bleeds time, money, or both — the two resources founders have least.

### Problem Impact

Founders abandon viable ideas because they can't afford to build them. Those who push forward burn through runway on development before they can validate their market. The gap between "I have an idea" and "I have a product users can try" remains one of the biggest killers of early-stage startups.

### Why Existing Solutions Fall Short

- **Self-coding:** Founders spend months learning to code instead of building their business. Most aren't engineers and shouldn't have to be.
- **Hiring developers/freelancers:** Expensive, slow, and loaded with communication overhead. The founder becomes a project manager instead of a visionary.
- **No-code platforms:** Limited flexibility, hard to customize, and lock founders into someone else's platform with inherent scaling ceilings.
- **AI coding assistants:** Tools like Cursor and Copilot still require a human pilot — a technically skilled operator making decisions, debugging, and steering the process. They accelerate developers; they don't replace the need for one.

### Proposed Solution

Startup Factory is a fully autonomous agent system that consumes structured product specifications and produces deployed, functional MVPs. A multi-agent pipeline — story creation, development, code review, QA testing — operates without human-in-the-loop cycling. A lean orchestrator dispatches specialist agents, each pulling their own context and writing to a shared workspace. Quality gates, independent test generation, failure escalation, and cost controls ensure the output is reliable, correct, and economical.

### Key Differentiators

- **True autonomy, not assisted coding:** No human pilot required. Founders provide vision, agents deliver product.
- **Comprehensive agent harness:** Purpose-built multi-agent orchestration with quality gates, failure recovery, escalation ladders, and architectural integrity — not just a wrapper around an LLM.
- **Structured input methodology:** BMAD planning artifacts give agents the well-defined specifications needed for autonomous execution, solving the "garbage in, garbage out" problem.
- **Right timing:** LLM capabilities have finally crossed the threshold where autonomous code generation, review, and QA are viable at production quality.

## Target Users

### Primary Users

**"Alex the Non-Technical Founder"**

Alex is a non-technical solo founder with a software product idea. They have domain expertise — maybe they've worked in real estate, healthcare, education, or e-commerce — and they've identified a problem worth solving. They've been sitting on this idea for months.

**Context & Motivation:**
- No engineering background; they're a business person, domain expert, or hustler with vision
- Has tried getting quotes from dev shops ($20k-$80k+) or explored no-code tools that couldn't handle their requirements
- Wants a real, deployable MVP — not a clickable prototype or a landing page
- Time-sensitive: they want to validate their market before the window closes or savings run out

**Problem Experience:**
- Stuck in the gap between "I know exactly what I want" and "I can't build it myself"
- Frustrated by the cost and communication overhead of hiring developers
- Hit the ceiling of no-code platforms and knows they need custom software
- Every week without a product is a week of lost validation and market learning

**Success Vision:**
- Comes in with a product specification, kicks off a build job, goes to bed
- Wakes up to a deployed, functional MVP with core features working
- Can immediately start showing it to users, getting feedback, and validating their business

### Secondary Users

N/A for MVP. Future consideration: agencies, accelerators, and product consultants who could use Startup Factory on behalf of founders. Also potential for technical founders who want to skip the manual coding grind.

### User Journey

1. **Entry:** Alex arrives with a product specification (structured enough for agents to consume)
2. **Setup:** Kicks off a build job via CLI — points Startup Factory at the spec
3. **Autonomous Build:** Agents execute the full pipeline overnight — story creation, development, code review, QA testing, deployment
4. **Aha Moment:** Alex wakes up, checks the CLI status, and opens a deployed, working MVP in their browser
5. **Value Realization:** Alex shares the app with potential customers that same day — weeks or months ahead of any alternative path

## Success Metrics

- **Build Success Rate:** 80%+ of jobs produce a deployable, functional MVP that matches the input specification
- **Output Quality:** Production-grade code — tests pass, architecture is sound, app behaves as specified (not demo-grade throwaway code)
- **Spec Fidelity:** The deployed app matches the product specification — acceptance criteria met, core features functional
- **Build Time:** Scales with complexity — simple apps overnight, more complex MVPs may take longer. Target: a straightforward MVP completes in a single overnight run
- **Cost Efficiency:** Build cost (API tokens, compute) scales proportionally with project complexity — no runaway spending (aligns with the cost circuit breaker from brainstorming)

### Business Objectives

N/A — Startup Factory is a personal-use tool first. Business viability will only be explored if it proves effective for the creator's own use. No revenue model, growth targets, or market metrics at this stage.

### Key Performance Indicators

| KPI | Target | Measurement |
|-----|--------|-------------|
| Build success rate | 80%+ | Successful deploys / total jobs kicked off |
| Spec match rate | 100% of acceptance criteria | QA agent validates against story specs |
| Overnight completion | Simple MVPs in <12 hours | Job start to deploy timestamp |
| Cost per build | Proportional to complexity | Token usage + compute tracked per job |
| Agent failure recovery | Escalation resolves without human | Retry/escalation success rate |

## MVP Scope

### Core Features

**1. Lean Batch Orchestrator (CLI)**
- CLI command that reads state file, dispatches agents sequentially, updates state, reports status
- Event-triggered dispatch pattern — reads state, detects what's next, dispatches appropriate agent
- Non-blocking orchestration: when a story is blocked, skip it and continue with non-colliding stories
- Structured state file (YAML) as single source of truth for coordination

**2. Agent Workspace**
- Shared workspace directory committed to the repo
- Filesystem as inter-agent communication protocol
- Agents pull their own context from workspace and state files

**3. Core Agent Pipeline**
- **Story Creator:** Consumes BMAD planning artifacts (epics, architecture, PRD) and generates implementation-ready story specs
- **Developer:** Implements stories based on story specs, writes code and tests
- **Code Reviewer:** Reviews code for quality, correctness, and spec adherence
- **QA/Test Agent:** Runs tests, validates app behavior against story spec acceptance criteria

**4. Failure Escalation (Three-Tier)**
- First failure: retry with fresh agent
- Second failure: escalate to more capable model tier
- Third failure: flag for human, pause story, continue non-colliding work
- Failure notes written to workspace so next attempt learns from previous

**5. Basic Cost Tracking**
- Log token usage, model used, and estimated cost per agent run to state file
- Per-story and per-sprint cumulative cost tallying
- CLI status includes cost breakdown

**6. BMAD Planning Artifact Input**
- Expects structured BMAD Phase 1-3 outputs: PRD, architecture doc, epics/stories, UX specs
- Agents consume these as source of truth for all implementation decisions

### Out of Scope for MVP

- Automated deployment (MVP produces build-ready, test-passing code)
- Cost circuit breaker (hard spending limits that pause work)
- Architecture Guard / convention enforcement
- Independent QA test generation (QA writing separate tests from dev)
- Scrum Master agent (strategic reordering, decomposition decisions)
- Cross-agent interpretation checks
- Progressive checkpoint protocol
- Context-window-aware story sizing
- Web UI or dashboard — CLI only
- BMAD Phase 1-3 planning assistance (users arrive with specs ready)
- Multi-user or team support

### MVP Success Criteria

- Can consume a set of BMAD planning artifacts and autonomously produce a working codebase with passing tests
- 80%+ build success rate on straightforward MVP-complexity projects
- Failure escalation resolves most agent failures without human intervention
- Non-blocking orchestration keeps the pipeline moving when individual stories get stuck
- Simple MVP completes in a single overnight run
- Cost per build is tracked and visible

### Future Vision

**Phase 2 — Resilience:** Cost circuit breaker, git branch per story, heartbeat/crash detection, API failover

**Phase 3 — Intelligence:** Independent QA test generation, cross-agent interpretation checks, Scrum Master agent, loop detection, cost-aware model selection

**Phase 4 — Maturity:** Architecture health checks, convention enforcement, context-window-aware story sizing, progressive checkpoints, continuous-mode orchestrator, BMAD planning phase integration

**Long-term:** A platform where anyone with a product idea can go from concept to deployed software autonomously — planning, building, testing, and deploying without writing a line of code or managing a single developer.
