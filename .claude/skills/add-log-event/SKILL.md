---
name: add-log-event
description: Add or change a structured integration log event (name and severity) in lib/observability/integration-log.ts without breaking log-based alerting.
---

# Add a log event

1. Choose a `snake_case` past-tense or state name (`thing_happened`). Reuse an existing event if the meaning is the same.
2. Add it to `EVENT_LEVELS` in `lib/observability/integration-log.ts` with a deliberate level: `error` = needs a human or a write failed; `warn` = rejected input or transient retry; `info` = normal progress.
3. Add the same entry to `EXPECTED_LEVELS` in `tests/observability/integration-log.test.ts`.
4. Context: IDs, SKUs, quantities, cent amounts, status codes, error class names (`describeErrorForLog`). Never customer data, payloads or secrets.
5. Update the logging table in `docs/operations/runbook.md` (and an incident playbook if it is `error`).
6. Update route tests whose `[level, event]` sequences change.
7. Renaming an event or changing its level is a **breaking change** for alerting: call it out explicitly.
