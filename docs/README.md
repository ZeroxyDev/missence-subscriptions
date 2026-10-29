# MISSENCE Subscriptions — documentation

This directory is the documentation home of the project. It is organised by
reader intent, and every page has a single owner: the code itself for
reference material, and humans for everything that explains *why*.

| I want to…                                        | Read                                                        |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Understand what the system does and how data flows | [Architecture overview](architecture/overview.md)          |
| Know which module may depend on which             | [Layers and dependency rules](architecture/layers.md)       |
| Understand a past design decision                 | [Architecture Decision Records](adr/README.md)              |
| Deploy, configure or operate the integration      | [Operations runbook](operations/runbook.md)                 |
| React to an alert (`price_mismatch`, …)           | [Runbook → incident playbooks](operations/runbook.md#incident-playbooks) |
| Look up a function, type or constant              | [API reference](reference/api.md) *(generated)*             |
| Write code that passes review                     | [Engineering standards](standards/engineering.md)           |
| Document code correctly                           | [Documentation standard (MDS)](standards/documentation.md)  |
| Use the AI agents and skills shipped with the repo | [AI tooling](ai-tooling.md)                                 |

## How the documentation system works

```text
           JSDoc in code  ──►  scripts/docs (TypeScript compiler API)
                                   │                 │
                     validate (MDS rules)      render reference
                                   │                 │
                         pnpm docs:check  ◄── compare ── docs/reference/api.md
                                   │
                              pnpm check  (CI gate)
```

- **Reference documentation is generated, never hand-written.** It cannot
  drift because `pnpm check` fails when the committed reference differs from
  what the code produces.
- **Explanatory documentation is hand-written** and lives next to the
  decisions it explains (ADRs, runbook, architecture).
- **The standard is machine-enforced.** Undocumented exports, wrong module
  ids, missing `@param`/`@returns` and unknown tags fail the build like a type
  error. See [the standard](standards/documentation.md) for every rule.

## Language

Code, comments and documentation are written in English. User-facing
strings (the operations page, health details and CLI prompts) are Spanish by
product decision and are part of the application's behaviour.
