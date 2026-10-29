---
name: add-product-pair
description: Add or change a subscription/experience product pair (SKU, product ID, variant ID, replacement) in the MISSENCE Shopify→Bigblue integration, with tests and docs. Use when the business launches a new subscription or experience product.
---

# Add a product pair

1. **Collect identifiers** for subscription, experience and the experience's physical replacement: SKU, Shopify product ID, variant ID (`legacyResourceId`). Never infer the replacement from the `-UP` suffix; ask if any value is missing.
2. **Edit** `config/subscription-product-pairs.ts`: append an entry with a unique `id` (`MISS_<sub>_<exp>`). Order matters only if one checkout could match two pairs (first match wins).
3. **Tests**: in `tests/subscriptions/domain/first-shipment-adjustment.test.ts` add cases for the new pair: detected with the experience, ignored on a subscription-only renewal, ignored on a variant mismatch. Add a pricing case in `tests/subscriptions/domain/bigblue-line-item-plan.test.ts` with real prices proving the Bigblue total equals the Shopify total.
4. **Health**: the `/api/health` products check counts pairs — update the expected detail (`"N reglas configuradas"`) in `tests/app/api/health.test.ts`.
5. **Verify**: `pnpm check`, then `pnpm missence dry-run` (read-only) against Bigblue.
6. **Docs**: `pnpm docs:generate`; mention the pair in the PR. Run the go-live checklist in `docs/operations/runbook.md` with one real combined order for the new pair.
