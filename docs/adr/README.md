# Architecture Decision Records

An ADR captures one significant decision: its context, the decision and its
consequences. ADRs are immutable once accepted; a change of mind is a new ADR
that supersedes the old one.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-shopify-is-the-source-of-truth.md) | Shopify is the source of truth; only the Bigblue logistics copy is adjusted | Accepted |
| [0002](0002-target-state-derived-from-shopify.md) | Target state is derived from Shopify, never from Bigblue | Accepted |
| [0003](0003-exact-money-verification.md) | Exact-to-the-cent money verification before and after every write | Accepted |
| [0004](0004-reconciliation-safety-net.md) | Webhook fast path backed by event and scheduled reconciliation | Accepted |
| [0005](0005-webhook-authentication.md) | Webhook authentication on the raw body; derived Bigblue URL token | Accepted |
| [0006](0006-layered-architecture-and-enforced-documentation.md) | Layered architecture and machine-enforced documentation | Accepted |

ADRs 0001–0005 record decisions already embodied in the code before this
documentation system existed; they were written down on 2026-10-08.

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What forces are at play? What problem are we solving?

## Decision
What we do, stated in full sentences.

## Consequences
What becomes easier or harder. Risks and follow-ups.
```
