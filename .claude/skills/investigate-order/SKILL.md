---
name: investigate-order
description: Triage why a specific Shopify order was not (or was wrongly) adjusted in Bigblue, from its log events, using the runbook. Read-only.
---

# Investigate an order

1. Gather all `bigblue_subscription_adjustment` log lines for the order (`shopifyOrderId` or `bigblueOrderId`), in time order.
2. Locate the last event and map it:
   - `ignored_no_pair` → compare `pairChecks[].expected` with `sameSku` lines: SKU, product ID or variant ID mismatch in `config/subscription-product-pairs.ts`?
   - `bigblue_not_ready` / `reconciliation_skipped: bigblue_not_ready` → Bigblue import delay; check `external_id` format.
   - `price_mismatch` → read `stage` and cent amounts; follow the runbook playbook.
   - `update_not_persisted` → Bigblue resync overwrote the write; cron will retry while `PENDING`.
   - `reconciliation_skipped: bigblue_not_pending` → too late to correct automatically.
   - `manual_review_required` → edit removed the pair.
3. If logs are missing entirely, check the Shopify webhook subscriptions and the cron (runbook → Setup).
4. Optional read-only check: `pnpm missence dry-run`.
5. Conclude: cause, evidence, action (none / manual fix / code fix with a failing test first).
