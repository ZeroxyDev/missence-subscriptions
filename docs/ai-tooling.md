# AI tooling

The repository ships Claude Code subagents and skills so that AI-assisted
work follows the same architecture, safety rules and documentation standard
as human work. They are plain Markdown in `.claude/` and versioned with the
code.

## Subagents (`.claude/agents/`)

| Agent | Writes code? | Use it to… |
| --- | --- | --- |
| `integration-auditor` | No | Audit money, idempotency and verify-after-write invariants before merging changes to the integration. |
| `architecture-guardian` | No | Decide where new code belongs and resolve layer violations. |
| `security-reviewer` | No | Review webhook auth, secrets, log privacy and client/server boundaries. |
| `incident-investigator` | No | Diagnose a production incident from log events using the runbook. |
| `test-engineer` | Yes (tests) | Write unit and route characterization tests. |
| `docs-steward` | Yes (docs) | Keep JSDoc, the generated reference, ADRs and the runbook compliant. |

Read-only agents can be run in parallel on the same change (e.g. auditor +
security reviewer + architecture guardian) to scale review without
conflicting edits.

## Skills (`.claude/skills/`)

| Skill | Procedure |
| --- | --- |
| `quality-gate` | Run and interpret `pnpm check` and `pnpm build`. |
| `add-product-pair` | Add a subscription/experience pair with tests and docs. |
| `add-endpoint` | Add a Route Handler: use case → thin route → tests → docs. |
| `add-log-event` | Add or change a log event without breaking alerting. |
| `document-code` | Apply the documentation standard. |
| `write-adr` | Record an architecture decision. |
| `investigate-order` | Triage one order from its logs. |

## Ground rules for agents

`AGENTS.md` (loaded through `CLAUDE.md`) carries the rules every agent must
follow: read the bundled Next.js docs, respect the layers, never write to
Shopify, run the quality gate before declaring work done.
