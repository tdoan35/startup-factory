# startup-factory

Autonomous MVP builder powered by AI agents. Provide structured planning artifacts, kick off a CLI build job, and wake up to a working, tested codebase.

Startup Factory is not a copilot — it's an autopilot. It removes the human from the implementation loop by combining structured [BMAD](https://github.com/bmadcode/BMAD-METHOD) planning artifacts with a multi-agent orchestration pipeline featuring quality gates, failure escalation, and non-blocking execution.

## How It Works

1. **Plan** — Create BMAD planning artifacts (product brief, PRD, architecture, epics/stories)
2. **Build** — Run `startup-factory build <artifact-path>` and walk away
3. **Wake up** — Come back to a codebase with passing tests and clear status on what completed

The pipeline dispatches four specialist agents in sequence per story:

- **Story Creator** — Expands epic stories into implementation-ready specs
- **Developer** — Writes the code
- **Code Reviewer** — Reviews for quality and correctness
- **QA** — Validates acceptance criteria

Failed stories escalate through a three-tier ladder (retry → smarter model → flag for human) while the pipeline continues with non-blocked stories.

## Installation

```bash
npm install -g startup-factory
```

Requires Node.js >= 20.

## Setup

```bash
cp .env.example .env
```

Set your `ANTHROPIC_API_KEY` in the `.env` file.

## Usage

```bash
# Run a full build from planning artifacts
startup-factory build <artifact-path>

# Build specific epics or stories
startup-factory build <artifact-path> --epics 1-3
startup-factory build <artifact-path> --story 1-1
startup-factory build <artifact-path> --story 1-1 1-5   # range

# Check build status
startup-factory status

# Retry a failed story
startup-factory retry <story-id>

# View cost breakdown
startup-factory cost
```

### Build Options

```
--max-retries <n>        Maximum retry attempts
--model <model>          Default model to use
--artifacts-path <path>  Artifacts directory path
--workspace-path <path>  Workspace directory path
--project-root <path>    Project root directory (where source code lives)
--config <path>          Path to config file
--claude-md <path>       Path to CLAUDE.md for project context
--epics <range>          Epic range to build (e.g. 1, 1-3, 2-, -3)
--story <ids...>         Story range to build (e.g. 1-1, or 1-1 1-3)
--output <format>        Output format: text, json, yaml
```

### Retry Options

```
--max-retries <n>        Maximum retry attempts
--model <model>          Default model to use
--config <path>          Path to config file
```

### Artifact Layout

Planning artifacts are read from the path you provide (typically `_bmad-output/planning-artifacts/`). Story artifacts (specs, reviews, QA reports) are written to the sibling `implementation-artifacts/stories/` directory:

```
_bmad-output/
├── planning-artifacts/    # Input: PRD, architecture, epics
└── implementation-artifacts/
    ├── stories/           # Output: spec.md, review.md, qa-report.md per story
    └── sprint-status.yaml # Updated automatically on story completion/failure
```

Internal pipeline state is tracked separately in `.startup-factory/state.yaml`.

## Development

```bash
npm install
npm run dev          # Run with tsx
npm run build        # Build with tsup
npm run test         # Run tests
npm run typecheck    # Type check
```

## License

ISC
