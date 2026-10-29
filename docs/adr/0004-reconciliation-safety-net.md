# 0004. Webhook fast path backed by event and scheduled reconciliation

- Status: Accepted
- Date: 2026-10-08 (records existing behaviour)

## Context

- Bigblue may import an order after Shopify delivers `orders/create`.
- Shopify allows five seconds per delivery and a limited number of retries.
- Bigblue may later overwrite our change with a resync from Shopify, and its
  status webhook is not documented to fire on line-item reverts.
- Shopify edits change quantities and totals after checkout.

## Decision

Three layers:

1. **Fast path** — `orders/create` adjusts Bigblue immediately within a
   four-second budget; anything transient returns `503` for redelivery.
2. **Event reconciliation** — `orders/updated`/`orders/edited` re-read the
   current order from the Admin API and reconcile it; the Bigblue
   `ORDER_STATUS_UPDATE` webhook triggers a store-wide pass.
3. **Scheduled reconciliation (required)** — an external scheduler calls
   `POST /api/cron/reconcile-bigblue` (e.g. every five minutes); it
   reconciles every first-shipment order from the last 48 hours while Bigblue
   reports `PENDING`.

## Consequences

- Correctness does not depend on any single delivery succeeding.
- The cron must be configured and monitored in production; deploying the
  code alone is not enough.
- Reconciliation is sequential to respect rate limits; the 48-hour window and
  pagination caps bound its cost.
