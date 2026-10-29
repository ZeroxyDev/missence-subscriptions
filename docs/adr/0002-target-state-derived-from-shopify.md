# 0002. Target state is derived from Shopify, never from Bigblue

- Status: Accepted
- Date: 2026-10-08 (records existing behaviour)

## Context

Webhooks are delivered at least once, may be retried many times, and several
triggers (Shopify events, Bigblue events, cron) can process the same order
concurrently or repeatedly. A rule such as "subtract the experience quantity
from Bigblue's current quantity" would subtract again on every retry.

## Decision

The desired Bigblue state (`targetQuantity`, replacement SKU, line pricing)
is a pure function of the Shopify order:

```text
targetQuantity = max(shopifySubscriptionQuantity − shopifyExperienceQuantity, 0)
```

Planning compares Bigblue's current lines with that target and reports
`alreadyAdjusted` when they match (quantities, SKUs and amounts). A write
happens only when they differ.

## Consequences

- Every operation is idempotent and convergent; retries are always safe.
- Re-planning after a write must yield `alreadyAdjusted`; this is how
  persistence is verified.
- Bigblue's existing amounts (e.g. a placeholder price on the replacement
  SKU) are overwritten with Shopify-derived pricing, never accumulated.
