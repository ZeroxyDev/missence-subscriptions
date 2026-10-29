# Operations runbook

Everything needed to configure, deploy, verify and operate the Shopify →
Bigblue first-shipment integration.

## Environment variables

Secrets are read only by [`config/server-env.ts`](../../config/server-env.ts)
(a `server-only` module), lazily on each request, and are never logged.

| Variable | Required for | Notes |
| --- | --- | --- |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhooks, health | App client secret used to verify `X-Shopify-Hmac-SHA256`. Legacy name `SHOPIFY_WEBHOOK_KEY` also accepted. |
| `SHOPIFY_ACCESS_TOKEN` | Reconciliation, order events | **Admin** GraphQL token with `read_orders` (not the Storefront token). `SHOPIFY_ADMIN_ACCESS_TOKEN` also accepted. |
| `SHOPIFY_STORE_DOMAIN` | Health, Admin fallback | Storefront domain (default `missence.com`). If it already is `cy6gdd-q8.myshopify.com`, it is reused for Admin calls. |
| `SHOPIFY_ADMIN_STORE_DOMAIN` | Reconciliation, order events | Permanent `*.myshopify.com` hostname when `SHOPIFY_STORE_DOMAIN` is a public domain. Strictly validated. |
| `SHOPIFY_PRIVATE_ACCESS_TOKEN` | Health | Private Storefront token; server-only. |
| `SHOPIFY_PUBLIC_ACCESS_TOKEN` | — | Reserved for future client use; unused today. |
| `BIGBLUE_API_KEY` | All Bigblue calls | Sent as `Authorization: Bearer …` to the Store API. |
| `BIGBLUE_WEBHOOK_KEY` | Bigblue webhook | Bigblue app *Shared secret*: verifies the HMAC and derives the optional URL token. Same value locally and on Vercel. |
| `RECONCILIATION_CRON_SECRET` | Cron | Long random secret the scheduler sends as `Authorization: Bearer …`. Never put it in a URL. |

Copy [`.env.example`](../../.env.example) to `.env` for local work.

## Endpoints

| Endpoint | Caller | Purpose |
| --- | --- | --- |
| `POST /api/webhooks/shopify/orders-create` | Shopify `orders/create` | Fast-path adjustment |
| `POST /api/webhooks/shopify/order-events` | Shopify `orders/updated`, `orders/edited` | Reconcile one changed order |
| `POST /api/webhooks/bigblue/order-status` | Bigblue *Order Status Update* | Store-wide reconciliation trigger + URL verification |
| `GET /api/webhooks/bigblue/order-status?token=…` | Operators | Authenticated liveness probe |
| `POST /api/cron/reconcile-bigblue` | External scheduler | **Required** periodic reconciliation |
| `GET /api/health` | Operations page | Connectivity status (cached 30 s) |

Status codes and bodies per endpoint are documented at the top of each route
file and in the [API reference](../reference/api.md).

## Setup

### Shopify

Register three JSON webhook subscriptions:

```text
Topic: orders/create   URL: https://<domain>/api/webhooks/shopify/orders-create
Topic: orders/updated  URL: https://<domain>/api/webhooks/shopify/order-events
Topic: orders/edited   URL: https://<domain>/api/webhooks/shopify/order-events
```

Do not point `orders/create` at the order-events URL. Enable the two
order-event subscriptions only after the route is deployed.

### Bigblue

In the Bigblue webhook screen select **Order Status Update** (never
*Inventory Update*). The target URL can be the clean
`https://<domain>/api/webhooks/bigblue/order-status`; real events are
authenticated by HMAC. On registration Bigblue sends a `URL_VERIFICATION`
POST with `{"challenge": "…"}`; the receiver answers `200` with the same JSON
and does not run any reconciliation.

To print the optional private URL (enables authenticated `GET` probes):

```bash
node --env-file=.env --import tsx scripts/print-bigblue-webhook-url.mjs https://<domain>
```

The printed URL is secret.

### Scheduler (required)

Configure an external cron (e.g. every five minutes on Vercel Hobby) to send:

```http
POST https://<domain>/api/cron/reconcile-bigblue
Authorization: Bearer <RECONCILIATION_CRON_SECRET>
```

Before enabling it, set `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN`
(or `SHOPIFY_ADMIN_STORE_DOMAIN`), `BIGBLUE_API_KEY` and
`RECONCILIATION_CRON_SECRET` on Vercel. Monitor non-`200` responses and the
`reconciliation_finished` event.

## Go-live checklist

1. `SHOPIFY_WEBHOOK_SECRET` is the client secret of the app that signs the webhooks.
2. `pnpm missence dry-run` passes (read-only: never calls `UpdateOrder`, never prints order data).
3. Place one combined test order per configured pair.
4. Shopify keeps every line and quantity unchanged.
5. Bigblue removes or reduces only the subscription line and ships the configured replacement for the experience.
6. The experience line in Bigblue carries the expected price, tax and discount; Bigblue's total equals Shopify's.
7. Redeliver the same webhook: the response is `alreadyAdjusted` with no duplicated lines.
8. Place a renewal without the experience: the response is `no_matching_pair`.
9. The cron returns `200` and logs `reconciliation_finished`.

## Logging

Every event is logged as
`console.<level>("bigblue_subscription_adjustment", { event, ...context })`.
Context contains IDs, pair, SKUs, quantities, amounts, statuses and error
class names only — never credentials, names, emails or addresses. The
catalogue and levels live in
[`integration-log.ts`](../../lib/observability/integration-log.ts); route
tests pin the sequence emitted by each endpoint.

| Event | Level | Meaning |
| --- | --- | --- |
| `ignored_no_pair` | info | Order has no configured pair. Includes diagnostics: received lines and, per pair, expected IDs vs lines with the same SKU (distinguishes a missing SKU from a wrong product/variant ID). |
| `adjustment_detected` | info | First-shipment order detected. |
| `bigblue_order_found` | info | Bigblue copy located. |
| `adjustment_planned` | info | Lines, quantities and amounts before/after the plan. |
| `already_adjusted` | info | Bigblue already correct; no write. |
| `update_verified` | info | Re-read after write confirms the target state. |
| `price_verified` | info | Bigblue total equals Shopify total. |
| `updated` | info | Write completed and verified. |
| `shopify_order_event_received` | info | `orders/updated`/`orders/edited` accepted. |
| `bigblue_webhook_received` | info | Signed Bigblue status event accepted. |
| `reconciliation_finished` | info | Batch summary (`scanned`, `matched`, `updated`, `alreadyAdjusted`, `skipped`, `failed`). |
| `bigblue_not_ready` | warn | Bigblue has not imported the order yet; `503` returned. |
| `update_not_persisted` | warn | Re-read does not match the write; `503` returned. |
| `reconciliation_skipped` | warn | Order skipped (cancelled, not unfulfilled, Bigblue not pending / not imported). |
| `invalid_shopify_hmac` | warn | Signature check failed. |
| `invalid_shopify_topic` | warn | Unexpected topic header. |
| `invalid_shopify_payload` | warn | Malformed body or shop-domain mismatch. |
| `price_mismatch` | error | Totals or currencies cannot be matched exactly (`stage`: `currency`, `customer_price`, `planned`, `persisted`). |
| `update_failed` | error | Bigblue API error, invalid Bigblue response or unexpected error on `orders/create`. |
| `reconciliation_failed` | error | A reconciliation (or one order within it) failed; `reason` is the error class name. |
| `reconciliation_configuration_error` | error | A required secret is missing. |
| `manual_review_required` | error | An edited order no longer matches its pair. |

## Incident playbooks

### `price_mismatch`

1. Read `stage` and the cent amounts in the event.
2. `currency` / `customer_price`: the order involves a currency conversion or
   inconsistent totals. The integration will not adjust it. Fix the Bigblue
   order manually if needed.
3. `planned`: Bigblue's current header amounts (shipping, `additional_tax`,
   `additional_discount`) differ from what Shopify implies. Compare
   `plannedTotalCents` with `shopifyTotalCents`; check for discounts or
   shipping changes made directly in Bigblue.
4. `persisted`: Bigblue accepted the write but reports different amounts.
   Re-run the cron; if it persists, escalate to Bigblue with the order ID.

### `update_not_persisted`

Bigblue did not keep the change (often an immediate resync from Shopify).
The sender retries; the cron re-applies while the order is `PENDING`. If it
recurs for the same order, check Bigblue's Shopify sync settings.

### `bigblue_not_ready` / `reconciliation_skipped: bigblue_not_ready`

Normal right after checkout. Escalate only if it lasts more than a few cron
cycles: verify the order exists in Bigblue and that `external_id` is the
Shopify order name (`#1234`) or numeric ID.

### `reconciliation_skipped: bigblue_not_pending`

Bigblue started preparing the order before it was corrected. The service
cannot change it anymore: stop the preparation and resolve with Bigblue.

### `manual_review_required`

An edit removed the subscription or experience. There is no safe automatic
transformation; review the order in Shopify and Bigblue manually.

### `reconciliation_configuration_error`

A secret is missing on the deployment (`variable` names which). Set it on
Vercel and redeploy.

## Local tooling

```bash
pnpm missence            # interactive menu
pnpm missence check      # types + lint + tests + docs
pnpm missence dry-run    # read-only Bigblue smoke test
pnpm missence build      # production build
```
