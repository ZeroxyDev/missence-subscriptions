<!-- GENERATED FILE — do not edit. Run `pnpm docs:generate`. Source of truth: JSDoc in the code. -->

# API reference

Generated from source by the MISSENCE documentation engine (`scripts/docs`). 71 modules, 161 exported symbols.

See [the documentation standard](../standards/documentation.md) for how this file is produced and validated.

## Contents

- **App — Route Handlers and pages**
  - [`app/api/cron/reconcile-bigblue/route`](#app-api-cron-reconcile-bigblue-route)
  - [`app/api/health/route`](#app-api-health-route)
  - [`app/api/webhooks/bigblue/order-status/route`](#app-api-webhooks-bigblue-order-status-route)
  - [`app/api/webhooks/shopify/order-events/route`](#app-api-webhooks-shopify-order-events-route)
  - [`app/api/webhooks/shopify/orders-create/route`](#app-api-webhooks-shopify-orders-create-route)
  - [`app/layout`](#app-layout)
  - [`app/page`](#app-page)
- **Components**
  - [`components/brand/brand-logo`](#components-brand-brand-logo)
  - [`components/home/home-hero`](#components-home-home-hero)
  - [`components/layout/accent-bar`](#components-layout-accent-bar)
  - [`components/layout/developer-credit`](#components-layout-developer-credit)
  - [`components/layout/site-footer`](#components-layout-site-footer)
  - [`components/layout/site-header`](#components-layout-site-header)
  - [`components/operations/integration-status/integration-check-list`](#components-operations-integration-status-integration-check-list)
  - [`components/operations/integration-status/integration-status`](#components-operations-integration-status-integration-status)
  - [`components/operations/integration-status/use-integration-health`](#components-operations-integration-status-use-integration-health)
  - [`components/ui/hover-card`](#components-ui-hover-card)
  - [`components/ui/status-dot`](#components-ui-status-dot)
- **HTTP adapters**
  - [`lib/http/request-auth`](#lib-http-request-auth)
  - [`lib/http/responses`](#lib-http-responses)
- **Subscriptions — application (use cases)**
  - [`lib/subscriptions/application/handle-order-created`](#lib-subscriptions-application-handle-order-created)
  - [`lib/subscriptions/application/handle-order-event`](#lib-subscriptions-application-handle-order-event)
  - [`lib/subscriptions/application/process-first-shipment`](#lib-subscriptions-application-process-first-shipment)
  - [`lib/subscriptions/application/reconcile-first-shipments`](#lib-subscriptions-application-reconcile-first-shipments)
  - [`lib/subscriptions/application/run-reconciliation`](#lib-subscriptions-application-run-reconciliation)
- **Subscriptions — domain (pure rules)**
  - [`lib/subscriptions/domain/bigblue-line-item-plan`](#lib-subscriptions-domain-bigblue-line-item-plan)
  - [`lib/subscriptions/domain/first-shipment-adjustment`](#lib-subscriptions-domain-first-shipment-adjustment)
  - [`lib/subscriptions/domain/line-pricing`](#lib-subscriptions-domain-line-pricing)
- **Integration — Shopify**
  - [`lib/integrations/shopify/admin/errors`](#lib-integrations-shopify-admin-errors)
  - [`lib/integrations/shopify/admin/graphql-client`](#lib-integrations-shopify-admin-graphql-client)
  - [`lib/integrations/shopify/admin/order-mapper`](#lib-integrations-shopify-admin-order-mapper)
  - [`lib/integrations/shopify/admin/orders`](#lib-integrations-shopify-admin-orders)
  - [`lib/integrations/shopify/admin/queries`](#lib-integrations-shopify-admin-queries)
  - [`lib/integrations/shopify/admin/response-readers`](#lib-integrations-shopify-admin-response-readers)
  - [`lib/integrations/shopify/order-event`](#lib-integrations-shopify-order-event)
  - [`lib/integrations/shopify/order`](#lib-integrations-shopify-order)
  - [`lib/integrations/shopify/webhook-signature`](#lib-integrations-shopify-webhook-signature)
- **Integration — Bigblue**
  - [`lib/integrations/bigblue/client`](#lib-integrations-bigblue-client)
  - [`lib/integrations/bigblue/datetime`](#lib-integrations-bigblue-datetime)
  - [`lib/integrations/bigblue/errors`](#lib-integrations-bigblue-errors)
  - [`lib/integrations/bigblue/order-search`](#lib-integrations-bigblue-order-search)
  - [`lib/integrations/bigblue/order-totals`](#lib-integrations-bigblue-order-totals)
  - [`lib/integrations/bigblue/order-update`](#lib-integrations-bigblue-order-update)
  - [`lib/integrations/bigblue/parsers`](#lib-integrations-bigblue-parsers)
  - [`lib/integrations/bigblue/types`](#lib-integrations-bigblue-types)
  - [`lib/integrations/bigblue/webhook-signature`](#lib-integrations-bigblue-webhook-signature)
  - [`lib/integrations/bigblue/webhook-url-token`](#lib-integrations-bigblue-webhook-url-token)
- **Health**
  - [`lib/health/check-integration-health`](#lib-health-check-integration-health)
  - [`lib/health/types`](#lib-health-types)
- **Observability**
  - [`lib/observability/integration-log`](#lib-observability-integration-log)
- **Shared utilities**
  - [`lib/shared/async`](#lib-shared-async)
  - [`lib/shared/crypto`](#lib-shared-crypto)
  - [`lib/shared/errors`](#lib-shared-errors)
  - [`lib/shared/guards`](#lib-shared-guards)
  - [`lib/shared/money`](#lib-shared-money)
- **Configuration**
  - [`config/bigblue`](#config-bigblue)
  - [`config/fulfillment-settings`](#config-fulfillment-settings)
  - [`config/server-env`](#config-server-env)
  - [`config/shopify`](#config-shopify)
  - [`config/site`](#config-site)
  - [`config/subscription-product-pairs`](#config-subscription-product-pairs)
- **Tooling scripts**
  - [`scripts/bigblue-dry-run`](#scripts-bigblue-dry-run)
  - [`scripts/docs/cli`](#scripts-docs-cli)
  - [`scripts/docs/render-reference`](#scripts-docs-render-reference)
  - [`scripts/docs/rules`](#scripts-docs-rules)
  - [`scripts/docs/source-model`](#scripts-docs-source-model)
  - [`scripts/missence`](#scripts-missence)
  - [`scripts/print-bigblue-webhook-url`](#scripts-print-bigblue-webhook-url)
- **Root configuration**
  - [`eslint.config`](#eslint-config)
  - [`next.config`](#next-config)
  - [`postcss.config`](#postcss-config)

## App — Route Handlers and pages

### `app/api/cron/reconcile-bigblue/route`

Source: [`app/api/cron/reconcile-bigblue/route.ts`](../../app/api/cron/reconcile-bigblue/route.ts)

**`POST /api/cron/reconcile-bigblue` — scheduled reconciliation (required in production).**

Called by an external scheduler (e.g. every 5 minutes) with
`Authorization: Bearer <RECONCILIATION_CRON_SECRET>`. Re-applies the
first-shipment target to every recent order that Bigblue still has in
`PENDING`. Idempotent: when everything is correct, nothing is written.

| Status | Meaning                                                      |
| ------ | ------------------------------------------------------------ |
| 200    | Every order reconciled (`{ ok: true, ...summary }`)          |
| 401    | Missing or wrong bearer secret                               |
| 503    | Not configured, Shopify search failed, or any order failed   |

#### `runtime`

<sub>const</sub>

```ts
export const runtime = "nodejs";
```

`node:crypto` is required for constant-time secret comparison.

#### `maxDuration`

<sub>const</sub>

```ts
export const maxDuration = 60;
```

A full reconciliation pass may take several Shopify and Bigblue round-trips.

#### `POST`

<sub>function</sub>

```ts
export async function POST(request: Request): Promise<Response>
```

Runs one reconciliation pass.

| Parameter | Description |
| --- | --- |
| `request` | Scheduler request with the bearer secret. |

**Returns:** The reconciliation summary or an error response.

### `app/api/health/route`

Source: [`app/api/health/route.ts`](../../app/api/health/route.ts)

**`GET /api/health` — integration status for the operations page.**

Always answers `200`; the overall and per-check status are in the body.
Upstream probes are cached for 30 s server-side (see `checkIntegrationHealth`).

#### `runtime`

<sub>const</sub>

```ts
export const runtime = "nodejs";
```

Health probes use Node APIs and server-only configuration.

#### `dynamic`

<sub>const</sub>

```ts
export const dynamic = "force-dynamic";
```

Never prerender: the report must reflect live upstream state.

#### `GET`

<sub>function</sub>

```ts
export async function GET(): Promise<Response>
```

Returns the current integration health report.

**Returns:** A non-cacheable JSON {@link IntegrationHealth} response.

### `app/api/webhooks/bigblue/order-status/route`

Source: [`app/api/webhooks/bigblue/order-status/route.ts`](../../app/api/webhooks/bigblue/order-status/route.ts)

**`/api/webhooks/bigblue/order-status` — Bigblue *Order Status Update* webhook.**

- `POST URL_VERIFICATION`: Bigblue's registration handshake. The exact JSON
  challenge is echoed back; no order data is touched.
- `POST ORDER_STATUS_UPDATE`: HMAC-authenticated trigger for the idempotent
  store-wide reconciliation (including events caused by our own updates).
- `GET ?token=…[&challenge=…]`: authenticated liveness probe using the
  derived URL token (see `webhook-url-token.ts`).

Status events are not documented to fire on line-item reverts, so this
webhook complements, but does not replace, the reconciliation cron.

#### `runtime`

<sub>const</sub>

```ts
export const runtime = "nodejs";
```

`node:crypto` is required for HMAC verification.

#### `maxDuration`

<sub>const</sub>

```ts
export const maxDuration = 60;
```

A full reconciliation pass may take several Shopify and Bigblue round-trips.

#### `GET`

<sub>function</sub>

```ts
export async function GET(request: Request): Promise<Response>
```

Liveness probe for the private webhook URL.

| Parameter | Description |
| --- | --- |
| `request` | Request carrying `?token=` and optionally `?challenge=`. |

**Returns:** The challenge as plain text, `{ ok: true }`, or an auth error.

#### `POST`

<sub>function</sub>

```ts
export async function POST(request: Request): Promise<Response>
```

Handles URL verification and status-update deliveries.

| Parameter | Description |
| --- | --- |
| `request` | Incoming webhook request. |

**Returns:** The HTTP response for Bigblue.

### `app/api/webhooks/shopify/order-events/route`

Source: [`app/api/webhooks/shopify/order-events/route.ts`](../../app/api/webhooks/shopify/order-events/route.ts)

**`POST /api/webhooks/shopify/order-events` — Shopify `orders/updated` and `orders/edited`.**

Re-reads the changed order from the Admin API and reconciles Bigblue while
it is still `PENDING`. Complements, but does not replace, the cron: it
cannot detect a Bigblue-side revert that leaves Shopify unchanged.

| Status | Body                                        | Meaning                              |
| ------ | ------------------------------------------- | ------------------------------------ |
| 200    | `{ ok: true, skipped, reason }`             | Cancelled, fulfilled or no pair      |
| 200    | `{ ok: true, ...summary }`                  | Reconciled                           |
| 400    | `invalid_topic` / `invalid_payload`         | Rejected delivery                    |
| 401    | `invalid_hmac` / `invalid_shop_domain`      | Authentication failed                |
| 503    | `reconciliation_failed` (`retryable`)       | Transient: Shopify should redeliver  |

#### `runtime`

<sub>const</sub>

```ts
export const runtime = "nodejs";
```

`node:crypto` is required for HMAC verification.

#### `maxDuration`

<sub>const</sub>

```ts
export const maxDuration = 30;
```

Platform ceiling; the handler itself budgets {@link WEBHOOK_PROCESSING_BUDGET_MS}.

#### `POST`

<sub>function</sub>

```ts
export async function POST(request: Request): Promise<Response>
```

Handles one `orders/updated` or `orders/edited` delivery.

Order of checks: HMAC → topic → shop domain → payload → business logic.

| Parameter | Description |
| --- | --- |
| `request` | Incoming webhook request. |

**Returns:** The HTTP response for Shopify.

### `app/api/webhooks/shopify/orders-create/route`

Source: [`app/api/webhooks/shopify/orders-create/route.ts`](../../app/api/webhooks/shopify/orders-create/route.ts)

**`POST /api/webhooks/shopify/orders-create` — Shopify `orders/create` webhook.**

Fast path of the integration: verifies the delivery, detects first-shipment
orders and adjusts the Bigblue logistics copy within Shopify's 5-second
response window.

| Status | Body `error`               | Meaning                                       |
| ------ | -------------------------- | --------------------------------------------- |
| 200    | –                          | Ignored, already adjusted, or updated         |
| 400    | `invalid_topic`            | Wrong `X-Shopify-Topic`                       |
| 400    | `invalid_shopify_payload`  | Body is not a valid order                     |
| 401    | `invalid_hmac`             | Signature check failed                        |
| 409    | `bigblue_api_error`        | Bigblue `412` (order no longer editable)      |
| 502    | `bigblue_api_error`        | Permanent Bigblue error                       |
| 503    | (various, `retryable`)     | Transient: Shopify should redeliver           |
| 500    | `internal_error`           | Unexpected failure (incl. missing config)     |

#### `runtime`

<sub>const</sub>

```ts
export const runtime = "nodejs";
```

`node:crypto` is required for HMAC verification.

#### `maxDuration`

<sub>const</sub>

```ts
export const maxDuration = 30;
```

Platform ceiling; the handler itself budgets {@link WEBHOOK_PROCESSING_BUDGET_MS}.

#### `POST`

<sub>function</sub>

```ts
export async function POST(request: Request): Promise<Response>
```

Handles one `orders/create` delivery.

Order of checks: HMAC on the raw body → topic → payload parsing → business logic.

| Parameter | Description |
| --- | --- |
| `request` | Incoming webhook request. |

**Returns:** The HTTP response for Shopify.

### `app/layout`

Source: [`app/layout.tsx`](../../app/layout.tsx)

**Root layout: document shell, global styles and site metadata.**

#### `metadata`

<sub>const</sub>

```ts
export const metadata: Metadata = {
  title: SITE_CONFIG.title,
  description: SITE_CONFIG.description,
  icons: {
    icon: SITE_CONFIG.brand.mark,
    apple: SITE_CONFIG.brand.mark,
  },
};
```

Default `<head>` metadata for every page.

#### `RootLayout`

<sub>function</sub>

```ts
export default function RootLayout({ children }: LayoutProps<"/">)
```

Wraps every page in the `<html>`/`<body>` shell (Spanish locale).

| Parameter | Description |
| --- | --- |
| `props` | Layout props; `children` is the active page. |

**Returns:** The document shell.

### `app/page`

Source: [`app/page.tsx`](../../app/page.tsx)

**Operations landing page (`/`).**

Composes layout and home components; holds no markup of its own beyond the
page shell. User-facing copy is intentionally in Spanish.

#### `Home`

<sub>function</sub>

```ts
export default function Home()
```

Renders the landing page: accent bar, header, hero and status footer.

**Returns:** The page element.

## Components

### `components/brand/brand-logo`

Source: [`components/brand/brand-logo.tsx`](../../components/brand/brand-logo.tsx)

**MISSENCE brand images (horizontal wordmark and square mark).**

#### `BrandWordmark`

<sub>function</sub>

```ts
export function BrandWordmark({ alt, className }: BrandImageProps)
```

Renders the horizontal MISSENCE wordmark.

| Parameter | Description |
| --- | --- |
| `props` | Alt text and classes. |

**Returns:** A Next.js `Image`.

#### `BrandMark`

<sub>function</sub>

```ts
export function BrandMark({ alt, className }: BrandImageProps)
```

Renders the square MISSENCE mark.

| Parameter | Description |
| --- | --- |
| `props` | Alt text and classes. |

**Returns:** A Next.js `Image`.

### `components/home/home-hero`

Source: [`components/home/home-hero.tsx`](../../components/home/home-hero.tsx)

**Hero section of the operations landing page.**

#### `HomeHero`

<sub>function</sub>

```ts
export function HomeHero()
```

Renders the headline and short description (Spanish, user-facing).

**Returns:** The hero `<section>`.

### `components/layout/accent-bar`

Source: [`components/layout/accent-bar.tsx`](../../components/layout/accent-bar.tsx)

**Thin brand-accent rule at the very top of the page.**

#### `AccentBar`

<sub>function</sub>

```ts
export function AccentBar()
```

Renders the 2px accent bar.

**Returns:** A decorative `<div>`.

### `components/layout/developer-credit`

Source: [`components/layout/developer-credit.tsx`](../../components/layout/developer-credit.tsx)

**"Developed by" credit linking to the developer's GitHub profile.**

#### `DeveloperCredit`

<sub>function</sub>

```ts
export function DeveloperCredit()
```

Renders the developer credit with avatar (user-facing copy in Spanish).

**Returns:** An external link element.

### `components/layout/site-footer`

Source: [`components/layout/site-footer.tsx`](../../components/layout/site-footer.tsx)

**Page footer: brand mark, live integration status and developer credit.**

Server component; only the integration status inside it hydrates on the client.

#### `SiteFooter`

<sub>function</sub>

```ts
export function SiteFooter()
```

Renders the three-column footer (two columns on mobile, status on its own row).

**Returns:** The `<footer>` element.

### `components/layout/site-header`

Source: [`components/layout/site-header.tsx`](../../components/layout/site-header.tsx)

**Page header with the MISSENCE wordmark.**

#### `SiteHeader`

<sub>function</sub>

```ts
export function SiteHeader()
```

Renders the site header.

**Returns:** The `<header>` element.

### `components/operations/integration-status/integration-check-list`

Source: [`components/operations/integration-status/integration-check-list.tsx`](../../components/operations/integration-status/integration-check-list.tsx)

**List of individual integration checks shown inside the status card.**

#### `IntegrationCheckList`

<sub>function</sub>

```ts
export function IntegrationCheckList({ checks }: { checks: readonly IntegrationCheck[] })
```

Renders one row per check: label and either "Correcto" or the error detail.

| Parameter | Description |
| --- | --- |
| `props` | Checks from the health report. |

**Returns:** A `<ul>`.

### `components/operations/integration-status/integration-status`

Source: [`components/operations/integration-status/integration-status.tsx`](../../components/operations/integration-status/integration-status.tsx)

**Footer widget showing live integration health.**

Composes the polling hook with generic UI primitives: a status dot with a
label, and a hover/focus card listing each check. Copy is in Spanish
(user-facing).

#### `IntegrationStatus`

<sub>function</sub>

```ts
export function IntegrationStatus()
```

Live integration status indicator.

States: checking (neutral dot) → healthy (accent dot) or incident (dark dot).

**Returns:** The status button and its tooltip.

### `components/operations/integration-status/use-integration-health`

Source: [`components/operations/integration-status/use-integration-health.ts`](../../components/operations/integration-status/use-integration-health.ts)

**Client hook that polls `GET /api/health`.**

Separates data fetching from presentation so the status widget is a pure
function of `{ health, requestFailed }`.

#### `IntegrationHealthState`

<sub>type</sub>

```ts
export type IntegrationHealthState = {
  /** Last successful report, or `null` before the first one arrives. */
  health: IntegrationHealth | null;
  /** `true` when the most recent request failed. */
  requestFailed: boolean;
};
```

State exposed by {@link useIntegrationHealth}.

#### `useIntegrationHealth`

<sub>function</sub>

```ts
export function useIntegrationHealth(): IntegrationHealthState
```

Fetches the health report on mount and every minute.

Late responses after unmount are ignored and the interval is cleared.

**Returns:** The latest health state.

**Side effects:** Issues `fetch` requests while mounted.

### `components/ui/hover-card`

Source: [`components/ui/hover-card.tsx`](../../components/ui/hover-card.tsx)

**Floating panel revealed on hover or keyboard focus of its group.**

Generic UI primitive. The trigger and the card must share a parent with the
Tailwind `group` class; the card becomes visible on `group-hover` and
`group-focus-within`, so it is reachable by keyboard without JavaScript.

#### `HoverCard`

<sub>function</sub>

```ts
export function HoverCard({ id, title, children }: HoverCardProps)
```

Renders the floating panel above its trigger (centred from `md` up).

| Parameter | Description |
| --- | --- |
| `props` | Id, heading and content. |

**Returns:** The panel element.

### `components/ui/status-dot`

Source: [`components/ui/status-dot.tsx`](../../components/ui/status-dot.tsx)

**Small coloured dot that encodes a status.**

Generic UI primitive: no domain knowledge, server- and client-safe.

#### `StatusTone`

<sub>type</sub>

```ts
export type StatusTone = "pending" | "ok" | "error";
```

Visual states of a {@link StatusDot}.

#### `StatusDot`

<sub>function</sub>

```ts
export function StatusDot({ tone }: { tone: StatusTone })
```

Renders a 6px status dot.

| Parameter | Description |
| --- | --- |
| `props` | `tone` selects the colour. |

**Returns:** A decorative `<span>`; pair it with a text label for accessibility.

## HTTP adapters

### `lib/http/request-auth`

Source: [`lib/http/request-auth.ts`](../../lib/http/request-auth.ts)

**Request authentication helpers for Route Handlers.**

#### `SecretLoadResult`

<sub>type</sub>

```ts
export type SecretLoadResult =
  | { ok: true; secret: string }
  | { ok: false; response: Response };
```

Result of {@link loadRequiredSecret}: either the secret or a ready-made error response.

#### `loadRequiredSecret`

<sub>function</sub>

```ts
export function loadRequiredSecret(load: () => string, variable: string): SecretLoadResult
```

Loads a secret needed to authenticate a request, converting a missing
configuration into a logged `503 not_configured` response.

| Parameter | Description |
| --- | --- |
| `load` | Typed getter from `config/server-env`. |
| `variable` | Variable name to report in the log (never the value). |

**Returns:** The secret, or the response to return immediately.

**Side effects:** Logs `reconciliation_configuration_error` when the secret is missing.

#### `isAuthorizedBearer`

<sub>function</sub>

```ts
export function isAuthorizedBearer(header: string | null, secret: string): boolean
```

Checks an `Authorization: Bearer <token>` header in constant time.

| Parameter | Description |
| --- | --- |
| `header` | Raw `Authorization` header, or `null`. |
| `secret` | Expected token. |

**Returns:** `true` only for the exact `Bearer <secret>` value.

### `lib/http/responses`

Source: [`lib/http/responses.ts`](../../lib/http/responses.ts)

**Canonical JSON responses shared by the Route Handlers.**

Status codes are chosen for the *sender's retry semantics*, not only for
REST purity: Shopify and Bigblue redeliver on `5xx`, so every transient
condition answers `503`, and every permanent rejection answers `4xx`.

Note the caching policy: reconciliation endpoints set `Cache-Control:
no-store`; Shopify webhook endpoints historically do not. Preserve this
per-endpoint behaviour (it is pinned by the route tests).

#### `NO_STORE_HEADERS`

<sub>const</sub>

```ts
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
```

Disables caching at every layer (browser, CDN, Next.js).

#### `jsonError`

<sub>function</sub>

```ts
export function jsonError(error: string, { status, retryable, headers }: JsonErrorOptions): Response
```

Builds the standard error envelope `{ ok: false, retryable?, error }`.

| Parameter | Description |
| --- | --- |
| `error` | Stable, machine-readable error code (e.g. `"invalid_hmac"`). |
| `options` | Status, retryability and headers. |

**Returns:** A JSON `Response`.

#### `unauthorizedResponse`

<sub>function</sub>

```ts
export function unauthorizedResponse(): Response
```

`401` for a missing or wrong bearer/URL token.

**Returns:** A JSON `Response`.

#### `notConfiguredResponse`

<sub>function</sub>

```ts
export function notConfiguredResponse(): Response
```

`503` for a required secret that is not configured on the server.

**Returns:** A JSON `Response`.

#### `reconciliationSummaryResponse`

<sub>function</sub>

```ts
export function reconciliationSummaryResponse(summary: ReconciliationSummary): Response
```

Translates a reconciliation summary into a response: `200` when every
order succeeded, `503` otherwise so the caller retries.

| Parameter | Description |
| --- | --- |
| `summary` | Batch summary. |

**Returns:** A non-cacheable JSON `Response` containing `ok` and the summary counters.

#### `reconciliationFailedResponse`

<sub>function</sub>

```ts
export function reconciliationFailedResponse(): Response
```

`503` when the reconciliation could not run at all.

**Returns:** A non-cacheable JSON `Response`.

## Subscriptions — application (use cases)

### `lib/subscriptions/application/handle-order-created`

Source: [`lib/subscriptions/application/handle-order-created.ts`](../../lib/subscriptions/application/handle-order-created.ts)

**Use case: react to a verified Shopify `orders/create` delivery.**

This is the fast path. It runs inside Shopify's 5-second webhook window
and adjusts Bigblue immediately when possible; anything it cannot finish is
surfaced as a retryable error so Shopify redelivers, with reconciliation as
the final safety net.

#### `OrderCreatedOutcome`

<sub>type</sub>

```ts
export type OrderCreatedOutcome =
  | { kind: "ignored" }
  | { kind: "processed"; result: FirstShipmentResult };
```

Outcome of {@link handleOrderCreated}.

#### `OrderCreatedInput`

<sub>type</sub>

```ts
export type OrderCreatedInput = {
  /** HMAC-verified, parsed order. */
  order: ShopifyOrder;
  /** `X-Shopify-Webhook-Id`, for log correlation. */
  webhookId: string | undefined;
  /**
   * Lazily creates the Bigblue client. Deferred so that orders without a
   * configured pair never require Bigblue credentials.
   */
  createBigblueRequest: () => BigblueRequest;
};
```

Input of {@link handleOrderCreated}.

#### `handleOrderCreated`

<sub>function</sub>

```ts
export async function handleOrderCreated({
  order,
  webhookId,
  createBigblueRequest,
}: OrderCreatedInput): Promise<OrderCreatedOutcome>
```

Detects whether a new order is a first shipment and, if so, adjusts Bigblue.

| Parameter | Description |
| --- | --- |
| `input` | Order, correlation ID and Bigblue client factory. |

**Returns:** `ignored` for orders without a configured pair, otherwise the
processing result.

**Throws:** Everything {@link processFirstShipmentAdjustment} throws, plus
`EnvironmentConfigurationError` from the client factory.

**Side effects:** Logs `ignored_no_pair` (with diagnostics) or `adjustment_detected`;
may update Bigblue.

### `lib/subscriptions/application/handle-order-event`

Source: [`lib/subscriptions/application/handle-order-event.ts`](../../lib/subscriptions/application/handle-order-event.ts)

**Use case: react to a verified Shopify `orders/updated` or `orders/edited` delivery.**

The event only tells us *which* order changed. Its current state is re-read
from the Admin API (using `currentQuantity` and `currentTotalPriceSet`) and
reconciled against Bigblue while Bigblue still reports `PENDING`.

#### `OrderEventOutcome`

<sub>type</sub>

```ts
export type OrderEventOutcome =
  | { kind: "skipped"; reason: "cancelled" | "not_unfulfilled" }
  | { kind: "no_matching_pair"; manualReview: boolean }
  | { kind: "reconciled"; summary: ReconciliationSummary };
```

Outcome of {@link handleOrderEvent}.

#### `OrderEventInput`

<sub>type</sub>

```ts
export type OrderEventInput = {
  /** Order ID extracted from the verified payload. */
  orderId: number;
  /** Verified webhook topic. */
  topic: ShopifyOrderEventTopic;
  /** Permanent `*.myshopify.com` hostname (already checked against the delivery). */
  storeDomain: string;
  /** Lazily creates the Bigblue client, only when there is something to reconcile. */
  createBigblueRequest: () => BigblueRequest;
};
```

Input of {@link handleOrderEvent}.

#### `handleOrderEvent`

<sub>function</sub>

```ts
export async function handleOrderEvent({
  orderId,
  topic,
  storeDomain,
  createBigblueRequest,
}: OrderEventInput): Promise<OrderEventOutcome>
```

Re-reads the changed order from Shopify and reconciles Bigblue.

Shopify-side guards:
- cancelled or no longer `UNFULFILLED` → skipped, Bigblue untouched;
- no configured pair → skipped; if the order was *edited*, the edit removed
  the pair and there is no safe automatic transformation, so manual review
  is requested.

A Bigblue order that is not imported yet counts as `failed`, so the caller
answers `503` and Shopify redelivers.

| Parameter | Description |
| --- | --- |
| `input` | Order reference, store and Bigblue client factory. |

**Returns:** The outcome to translate into an HTTP response.

**Throws:** `Error` When the Admin API does not return the order yet (retryable).

**Throws:** `ShopifyAdminOrdersError` When the Admin API call fails.

**Throws:** `EnvironmentConfigurationError` When a credential is missing.

**Side effects:** Reads Shopify, may update Bigblue, emits log events.

### `lib/subscriptions/application/process-first-shipment`

Source: [`lib/subscriptions/application/process-first-shipment.ts`](../../lib/subscriptions/application/process-first-shipment.ts)

**Use case: bring one Bigblue order to its first-shipment target state.**

Pipeline (each step either passes or throws, nothing is partially applied):

```text
locate Bigblue order ─► guard status/currency/totals ─► plan lines
       │                                                    │
       ▼                                                    ▼
 NotReady (retry)                       already correct? ─► return (no write)
                                                            │
                                         UpdateOrder ─► re-read ─► verify
```

Safety invariants:
1. **Exact money**: nothing is written unless the planned Bigblue total
   equals Shopify's `total_price` to the cent, in the same currency.
2. **Verify after write**: success is declared only after re-reading the
   order and confirming lines, currency, computed total *and* Bigblue's
   reported `total`.
3. **Idempotency**: the target is derived from Shopify only, so repeated
   deliveries converge and do not write when Bigblue is already correct.

#### `FirstShipmentResult`

<sub>type</sub>

```ts
export type FirstShipmentResult =
  | {
      ok: true;
      /** Bigblue already held the target state; nothing was written. */
      alreadyAdjusted: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      targetQuantity: number;
    }
  | {
      ok: true;
      /** Bigblue was updated and the update was verified. */
      updated: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      previousQuantity: number;
      targetQuantity: number;
    };
```

Successful outcome of {@link processFirstShipmentAdjustment}.

#### `ProcessFirstShipmentOptions`

<sub>type</sub>

```ts
export type ProcessFirstShipmentOptions = {
  /**
   * Only act while Bigblue reports `PENDING`. Used by reconciliation paths,
   * which may run long after checkout when the order could be in preparation.
   */
  requirePending?: boolean;
};
```

Options for {@link processFirstShipmentAdjustment}.

#### `BigblueOrderNotPendingError`

<sub>class</sub>

```ts
export class BigblueOrderNotPendingError extends Error
```

Bigblue has moved the order beyond `PENDING`; it can no longer be safely
modified and is skipped by reconciliation.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `orderId` | Bigblue order ID. |
| `status` | Current status code, if reported. |

#### `processFirstShipmentAdjustment`

<sub>function</sub>

```ts
export async function processFirstShipmentAdjustment(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
  options: ProcessFirstShipmentOptions = {},
): Promise<FirstShipmentResult>
```

Applies a detected first-shipment adjustment to the Bigblue copy of an
order, verifying money and persistence end to end.

| Parameter | Description |
| --- | --- |
| `request` | Bigblue RPC function (carries the caller's deadline). |
| `order` | Shopify order (source of truth). |
| `adjustment` | Output of `detectFirstShipmentAdjustment` with `shouldAdjust: true`. |
| `options` | See {@link ProcessFirstShipmentOptions}. |

**Returns:** Whether Bigblue was already correct or has been updated.

**Throws:** `BigblueOrderNotReadyError` Bigblue has not imported the order yet (retryable).

**Throws:** `BigblueOrderNotPendingError` `requirePending` is set and Bigblue moved on.

**Throws:** `InvalidBigblueResponseError` Money/currency mismatch, ambiguous lines,
or the update did not persist (retryable).

**Throws:** `BigblueApiError` Transport/HTTP failure talking to Bigblue.

**Side effects:** May call Bigblue `UpdateOrder`; emits structured log events.

### `lib/subscriptions/application/reconcile-first-shipments`

Source: [`lib/subscriptions/application/reconcile-first-shipments.ts`](../../lib/subscriptions/application/reconcile-first-shipments.ts)

**Use case: re-apply the first-shipment target to a batch of orders.**

Reconciliation is the safety net behind the `orders/create` webhook. Bigblue
may import an order late or later overwrite our change with a resync from
Shopify; reconciliation compares each candidate against Shopify's current
state and re-applies the target while Bigblue still reports `PENDING`.
It is idempotent, so it can run as often as needed.

Orders are processed sequentially to stay well within Bigblue rate limits
and to keep logs causally ordered. One failing order never aborts the batch.

#### `ReconciliationSummary`

<sub>type</sub>

```ts
export type ReconciliationSummary = {
  /** Candidates received. */
  scanned: number;
  /** Candidates that are first-shipment orders eligible for processing. */
  matched: number;
  /** Orders written and verified in Bigblue. */
  updated: number;
  /** Orders already in the target state (no write). */
  alreadyAdjusted: number;
  /** Ineligible orders (cancelled, fulfilled, no pair, not pending, not imported). */
  skipped: number;
  /** Orders that errored and should be retried. */
  failed: number;
};
```

Counters returned to the caller and logged as `reconciliation_finished`.

#### `ReconcileOptions`

<sub>type</sub>

```ts
export type ReconcileOptions = {
  /**
   * Count a Bigblue order that is not imported yet as `failed` (so the caller
   * returns `503` and the sender redelivers) instead of `skipped`. Used by
   * event-driven triggers; the cron leaves it off and simply tries next cycle.
   */
  retryNotReady?: boolean;
};
```

Options for {@link reconcileFirstShipments}.

#### `reconcileFirstShipments`

<sub>function</sub>

```ts
export async function reconcileFirstShipments(
  candidates: readonly ReconciliationCandidate[],
  bigblueRequest: BigblueRequest,
  options: ReconcileOptions = {},
): Promise<ReconciliationSummary>
```

Reconciles each candidate against Bigblue and returns aggregate counters.

Classification per candidate:
- cancelled or not `UNFULFILLED` in Shopify → `skipped`
- no configured pair → `skipped`
- Bigblue not pending, or not imported (unless `retryNotReady`) → `skipped`
- any other error → `failed`

| Parameter | Description |
| --- | --- |
| `candidates` | Orders read from the Shopify Admin API. |
| `bigblueRequest` | Bigblue RPC function. |
| `options` | See {@link ReconcileOptions}. |

**Returns:** The batch summary.

**Side effects:** May update Bigblue orders; logs per-order outcomes and
`reconciliation_finished`.

### `lib/subscriptions/application/run-reconciliation`

Source: [`lib/subscriptions/application/run-reconciliation.ts`](../../lib/subscriptions/application/run-reconciliation.ts)

**Composition root for the periodic, store-wide reconciliation.**

Wires real credentials and clients into {@link reconcileFirstShipments}.
Shared by the cron endpoint and the Bigblue status webhook.

#### `runRecentBigblueReconciliation`

<sub>function</sub>

```ts
export async function runRecentBigblueReconciliation(): Promise<ReconciliationSummary>
```

Reconciles every first-shipment order created in the last 48 hours.

**Returns:** The batch summary.

**Throws:** `EnvironmentConfigurationError` When a required credential is missing.

**Throws:** `ShopifyAdminOrdersError` When the Shopify order search fails.

**Side effects:** Reads Shopify, may update Bigblue, emits log events.

## Subscriptions — domain (pure rules)

### `lib/subscriptions/domain/bigblue-line-item-plan`

Source: [`lib/subscriptions/domain/bigblue-line-item-plan.ts`](../../lib/subscriptions/domain/bigblue-line-item-plan.ts)

**Pure planning of the Bigblue line items for a first shipment.**

Given Bigblue's current lines and the target from
`detectFirstShipmentAdjustment`, computes the exact line set to write and
whether Bigblue already holds it. Planning is a pure function of
(current lines, Shopify-derived target): applying the plan and planning
again yields `alreadyAdjusted: true`, which is the idempotency guarantee
every caller relies on.

#### `BigblueLineItemAdjustmentPlan`

<sub>type</sub>

```ts
export type BigblueLineItemAdjustmentPlan = {
  /** `true` when Bigblue already matches the target quantities, SKUs and pricing. */
  alreadyAdjusted: boolean;
  /** Loose subscription units Bigblue held before the plan. */
  previousQuantity: number;
  /** Complete line set to write (or already present). */
  lineItems: BigblueLineItem[];
};
```

Outcome of {@link planBigblueLineItemAdjustment}.

#### `planBigblueLineItemAdjustment`

<sub>function</sub>

```ts
export function planBigblueLineItemAdjustment(
  lineItems: readonly BigblueLineItem[],
  adjustment: ActionableAdjustment,
  settings: FulfillmentSettings,
): BigblueLineItemAdjustmentPlan
```

Plans the complete Bigblue line set for a first-shipment adjustment.

Rules:
- The experience line is normalised by `planExperienceSkuReplacement`.
- The subscription line is set to `targetQuantity` with Shopify pricing.
- A target of `0` removes the subscription line; `quantity: 0` is never sent.

| Parameter | Description |
| --- | --- |
| `lineItems` | Current Bigblue lines. |
| `adjustment` | Shopify-derived target. |
| `settings` | Fulfillment feature flags. |

**Returns:** The plan; `alreadyAdjusted` is `true` when no write is required
for line items.

**Throws:** `InvalidBigblueResponseError` When a non-zero target must be applied
but Bigblue does not hold exactly one subscription line (ambiguous state).

### `lib/subscriptions/domain/first-shipment-adjustment`

Source: [`lib/subscriptions/domain/first-shipment-adjustment.ts`](../../lib/subscriptions/domain/first-shipment-adjustment.ts)

**Detection of first-shipment orders and their target logistics state.**

Business rule: the experience product is only added to an initial checkout
or a resubscription, and each experience unit physically contains one unit
of the subscription product. When both appear in the same order, Bigblue
must ship `subscription − experience` loose subscription units, and the
experience line carries the value of the units it absorbed so the order
total is unchanged.

The target is always derived from Shopify, never from Bigblue's current
quantities. Re-running detection on the same order therefore converges on
the same state, which is what makes every write idempotent.

#### `FirstShipmentAdjustment`

<sub>type</sub>

```ts
export type FirstShipmentAdjustment =
  | {
      shouldAdjust: true;
      /** Matched pair identifier. */
      pair: ProductPairId;
      /** Shopify numeric order ID, as a string. */
      shopifyOrderId: string;
      subscriptionSku: string;
      experienceSku: string;
      /** SKU Bigblue ships instead of the experience when replacement is enabled. */
      experienceReplacementSku: string;
      /** Subscription units in the Shopify order. */
      subscriptionQuantity: number;
      /** Experience units in the Shopify order. */
      experienceQuantity: number;
      /** Bigblue pricing for the experience line (its own value + absorbed units). */
      experiencePricing: LinePricing;
      /** Bigblue pricing for the remaining loose subscription units. */
      subscriptionPricing: LinePricing;
      /** Loose subscription units Bigblue must ship: `max(subscription − experience, 0)`. */
      targetQuantity: number;
    }
  | {
      shouldAdjust: false;
    };
```

Result of {@link detectFirstShipmentAdjustment}.

#### `ActionableAdjustment`

<sub>type</sub>

```ts
export type ActionableAdjustment = Extract<FirstShipmentAdjustment, { shouldAdjust: true }>;
```

An adjustment that requires action in Bigblue.

#### `getFirstShipmentDetectionDiagnostics`

<sub>function</sub>

```ts
export function getFirstShipmentDetectionDiagnostics(order: ShopifyOrder)
```

Explains, for logging, why an order did or did not match each pair.

For every pair it lists the configured identity next to the order lines
that share its SKU, which pinpoints product/variant ID mismatches.

| Parameter | Description |
| --- | --- |
| `order` | Parsed Shopify order. |

**Returns:** A log-safe diagnostic object.

#### `detectFirstShipmentAdjustment`

<sub>function</sub>

```ts
export function detectFirstShipmentAdjustment(
  order: ShopifyOrder,
): FirstShipmentAdjustment
```

Determines whether an order is a first shipment and, if so, the exact
logistics state and pricing Bigblue must hold.

Value transfer: the experience line receives its own Shopify value plus the
value of the subscription units it absorbs; the remaining loose units keep
a prorated share. Total value is conserved, so Bigblue's order total stays
equal to Shopify's.

| Parameter | Description |
| --- | --- |
| `order` | Parsed Shopify order (webhook payload or Admin API read). |

**Returns:** The first matching pair's adjustment, or `{ shouldAdjust: false }`
(e.g. for a renewal, which contains only the subscription).

### `lib/subscriptions/domain/line-pricing`

Source: [`lib/subscriptions/domain/line-pricing.ts`](../../lib/subscriptions/domain/line-pricing.ts)

**Conversion of Shopify line amounts into Bigblue unit pricing.**

Shopify reports a unit price (possibly tax-inclusive), per-line tax lines
and a per-line total discount. Bigblue expects a *net* `unit_price`, a
`unit_tax` and a line `discount`. All arithmetic happens in integer cents.

#### `LinePricing`

<sub>type</sub>

```ts
export type LinePricing = {
  /** Net price per unit (tax excluded). */
  unitPrice: string;
  /** Tax per unit. */
  unitTax: string;
  /** Discount for the whole line, including any rounding remainder. */
  discount: string;
};
```

Bigblue pricing for one logistics line, as decimal strings.

#### `LineTotals`

<sub>type</sub>

```ts
export type LineTotals = {
  /** Net price for all units (tax excluded). */
  price: number;
  /** Tax for all units. */
  tax: number;
  /** Discount for all units. */
  discount: number;
};
```

Aggregated line amounts in integer cents.

#### `sumLineTotals`

<sub>function</sub>

```ts
export function sumLineTotals(items: readonly ShopifyOrderLineItem[], taxesIncluded: boolean): LineTotals
```

Sums Shopify line items into net price, tax and discount cents.

When Shopify prices include tax, the tax is subtracted from the gross price
so it is not counted twice once Bigblue adds `unit_tax` back.

| Parameter | Description |
| --- | --- |
| `items` | Shopify line items of one product. |
| `taxesIncluded` | Shopify `taxes_included` for the order. |

**Returns:** The aggregated totals in cents.

#### `toUnitPricing`

<sub>function</sub>

```ts
export function toUnitPricing(totals: LineTotals, quantity: number): LinePricing
```

Splits line totals into per-unit Bigblue pricing that reproduces the totals
exactly.

Unit price and unit tax are rounded *up* to whole cents; the over-allocation
this creates is added to the line discount. Consequently
`quantity × (unitPrice + unitTax) − discount` equals
`totals.price + totals.tax − totals.discount` to the cent.

| Parameter | Description |
| --- | --- |
| `totals` | Line totals in cents. |
| `quantity` | Units the line will ship. |

**Returns:** Per-unit pricing, or all zeros when `quantity` is `0`.

**Invariant:** `quantity × (unitPrice + unitTax) − discount === price + tax − discount` (in cents).

## Integration — Shopify

### `lib/integrations/shopify/admin/errors`

Source: [`lib/integrations/shopify/admin/errors.ts`](../../lib/integrations/shopify/admin/errors.ts)

**Error raised by the Shopify Admin GraphQL order reader.**

#### `ShopifyAdminOrdersError`

<sub>class</sub>

```ts
export class ShopifyAdminOrdersError extends Error
```

The Admin API call failed, or its response violated an expected invariant
(shape, currency consistency, pagination). The class name is logged as the
failure `reason`; keep it stable.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `message` | Diagnostic description (field paths, HTTP status; never values). |

### `lib/integrations/shopify/admin/graphql-client`

Source: [`lib/integrations/shopify/admin/graphql-client.ts`](../../lib/integrations/shopify/admin/graphql-client.ts)

**Single entry point for Shopify Admin GraphQL requests.**

#### `AdminGraphqlRequest`

<sub>type</sub>

```ts
export type AdminGraphqlRequest = {
  /** Permanent `*.myshopify.com` hostname. */
  storeDomain: string;
  /** Admin API token with `read_orders`. */
  accessToken: string;
  /** GraphQL document. */
  query: string;
  /** GraphQL variables. */
  variables: Record<string, unknown>;
  /** Abort the request after this many milliseconds. */
  timeoutMs: number;
  /** Injectable `fetch`, for tests. */
  fetchImplementation: typeof fetch;
};
```

Parameters of {@link postAdminGraphql}.

#### `postAdminGraphql`

<sub>function</sub>

```ts
export async function postAdminGraphql({
  storeDomain,
  accessToken,
  query,
  variables,
  timeoutMs,
  fetchImplementation,
}: AdminGraphqlRequest): Promise<Record<string, unknown>>
```

POSTs a GraphQL document to the Admin API and returns the response root.

Any HTTP error, non-JSON body or top-level GraphQL `errors` entry is turned
into a {@link ShopifyAdminOrdersError}. Partial data is never returned.

| Parameter | Description |
| --- | --- |
| `request` | Endpoint, credentials, document and timeout. |

**Returns:** The response root object (containing `data`).

**Throws:** `ShopifyAdminOrdersError` On any failure.

### `lib/integrations/shopify/admin/order-mapper`

Source: [`lib/integrations/shopify/admin/order-mapper.ts`](../../lib/integrations/shopify/admin/order-mapper.ts)

**Maps an Admin GraphQL order node onto the canonical `ShopifyOrder`.**

The mapped order goes through `parseShopifyOrder`, the same validator used
for webhooks, so both entry points produce identical domain input and the
same first-shipment adjustment.

#### `ReconciliationCandidate`

<sub>type</sub>

```ts
export type ReconciliationCandidate = {
  /** Current order state (after edits). */
  order: ShopifyOrder;
  /** `true` when `cancelledAt` is set. */
  cancelled: boolean;
  /** `true` when the order has been edited since checkout. */
  edited: boolean;
  /** `displayFulfillmentStatus`; only `"UNFULFILLED"` orders are reconciled. */
  fulfillmentStatus: string;
};
```

A Shopify order plus the status needed to decide whether it may be reconciled.

#### `parseReconciliationCandidate`

<sub>function</sub>

```ts
export function parseReconciliationCandidate(value: unknown): ReconciliationCandidate
```

Validates and maps one Admin GraphQL order node.

Rejects orders whose shop/presentment currencies disagree with their totals
and orders with more line items than were fetched.

| Parameter | Description |
| --- | --- |
| `value` | Raw `Order` node. |

**Returns:** The reconciliation candidate.

**Throws:** `ShopifyAdminOrdersError` On any shape or consistency violation.

**Throws:** `InvalidShopifyOrderError` When the mapped order fails canonical validation.

### `lib/integrations/shopify/admin/orders`

Source: [`lib/integrations/shopify/admin/orders.ts`](../../lib/integrations/shopify/admin/orders.ts)

**Reading current order state from the Shopify Admin GraphQL API.**

Used by every reconciliation path (cron, Bigblue webhook, Shopify order
events) to compare Bigblue against Shopify's *current* truth rather than a
possibly stale webhook payload.

#### `getReconciliationCandidate`

<sub>function</sub>

```ts
export async function getReconciliationCandidate({
  orderId,
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
}: AdminReaderOptions & { orderId: number }): Promise<ReconciliationCandidate | null>
```

Reads one order's current state.

| Parameter | Description |
| --- | --- |
| `options` | Order ID, credentials and optional `fetch`. |

**Returns:** The candidate, or `null` when the Admin API does not (yet) return it.

**Throws:** `ShopifyAdminOrdersError` On an invalid ID, API failure, malformed
response, or when Shopify returns a different order than requested.

#### `listRecentExperienceOrders`

<sub>function</sub>

```ts
export async function listRecentExperienceOrders({
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
  now = new Date(),
}: AdminReaderOptions & { now?: Date }): Promise<ReconciliationCandidate[]>
```

Lists orders from the last 48 hours that contain any configured experience
SKU, newest first, de-duplicated by order ID.

The search is a coarse server-side prefilter; the exact SKU + product +
variant match is still performed by the domain detector.

| Parameter | Description |
| --- | --- |
| `options` | Credentials, optional `fetch` and a clock override for tests. |

**Returns:** All matching candidates (at most `ORDERS_PAGE_SIZE × MAX_PAGES`).

**Throws:** `ShopifyAdminOrdersError` On API failure, malformed response,
invalid pagination, or when the result exceeds the pagination cap.

### `lib/integrations/shopify/admin/queries`

Source: [`lib/integrations/shopify/admin/queries.ts`](../../lib/integrations/shopify/admin/queries.ts)

**GraphQL documents for the Shopify Admin order reader.**

Only `current*` fields are used for quantities and totals: they reflect
order edits and refunds, unlike the original checkout values.

#### `LINE_ITEMS_PAGE_SIZE`

<sub>const</sub>

```ts
export const LINE_ITEMS_PAGE_SIZE = 10;
```

Line items fetched per order. Orders with more lines are rejected rather
than partially read, since a missing line could hide a configured product.

#### `ORDERS_PAGE_SIZE`

<sub>const</sub>

```ts
export const ORDERS_PAGE_SIZE = 10;
```

Orders fetched per page by the reconciliation search.

#### `RECENT_ORDERS_QUERY`

<sub>const</sub>

```ts
export const RECENT_ORDERS_QUERY = `
  query RecentExperienceOrders($search: String!, $after: String) {
    orders(first: ${ORDERS_PAGE_SIZE}, after: $after, query: $search, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
```

Newest-first search of orders matching a Shopify search string.

#### `ORDER_BY_ID_QUERY`

<sub>const</sub>

```ts
export const ORDER_BY_ID_QUERY = `
  query ExperienceOrder($id: ID!) {
    order(id: $id) { ${ORDER_FIELDS} }
  }
`;
```

Single order by global ID (`gid://shopify/Order/<id>`).

### `lib/integrations/shopify/admin/response-readers`

Source: [`lib/integrations/shopify/admin/response-readers.ts`](../../lib/integrations/shopify/admin/response-readers.ts)

**Strict, path-aware readers for Shopify Admin GraphQL responses.**

Each reader validates one value and throws a {@link ShopifyAdminOrdersError}
naming the exact JSON path on failure, which makes schema drift easy to
diagnose from logs without logging the payload itself.

#### `readObject`

<sub>function</sub>

```ts
export function readObject(value: unknown, path: string): Record<string, unknown>
```

Reads a JSON object.

| Parameter | Description |
| --- | --- |
| `value` | Raw value. |
| `path` | JSON path for the error message. |

**Returns:** The value as a record.

**Throws:** `ShopifyAdminOrdersError` When not a plain object.

#### `readArray`

<sub>function</sub>

```ts
export function readArray(value: unknown, path: string): unknown[]
```

Reads a JSON array.

| Parameter | Description |
| --- | --- |
| `value` | Raw value. |
| `path` | JSON path for the error message. |

**Returns:** The array.

**Throws:** `ShopifyAdminOrdersError` When not an array.

#### `readLegacyId`

<sub>function</sub>

```ts
export function readLegacyId(value: unknown, path: string): number
```

Reads a `legacyResourceId` (numeric ID serialised as a string).

| Parameter | Description |
| --- | --- |
| `value` | Raw value. |
| `path` | JSON path for the error message. |

**Returns:** A positive safe integer.

**Throws:** `ShopifyAdminOrdersError` When not a positive safe integer.

#### `readOptionalLegacyId`

<sub>function</sub>

```ts
export function readOptionalLegacyId(value: unknown, path: string): number | null
```

Reads `{ legacyResourceId }` from a nullable reference (e.g. a deleted product).

| Parameter | Description |
| --- | --- |
| `value` | Raw reference object or `null`. |
| `path` | JSON path for the error message. |

**Returns:** The numeric ID, or `null` when the reference is `null`.

**Throws:** `ShopifyAdminOrdersError` When present but malformed.

#### `readMoneyBagAmount`

<sub>function</sub>

```ts
export function readMoneyBagAmount(
  value: unknown,
  path: string,
  field: "shopMoney" | "presentmentMoney" = "shopMoney",
): string
```

Reads the amount of one currency of a `MoneyBag` (`{ shopMoney, presentmentMoney }`).

| Parameter | Description |
| --- | --- |
| `value` | Raw `MoneyBag`. |
| `path` | JSON path for the error message. |
| `field` | Which currency to read; defaults to the shop currency. |

**Returns:** The amount as a decimal string.

**Throws:** `ShopifyAdminOrdersError` When missing or not a valid amount.

### `lib/integrations/shopify/order-event`

Source: [`lib/integrations/shopify/order-event.ts`](../../lib/integrations/shopify/order-event.ts)

**Parsing of Shopify order-change webhooks (`orders/updated`, `orders/edited`).**

These payloads are only used to learn *which* order changed. The current
state is always re-read from the Admin API, because `orders/edited` carries
only the delta and `orders/updated` may be stale by the time it arrives.

#### `ShopifyOrderEventTopic`

<sub>type</sub>

```ts
export type ShopifyOrderEventTopic = "orders/updated" | "orders/edited";
```

Topics accepted by the order-events endpoint.

#### `InvalidShopifyOrderEventError`

<sub>class</sub>

```ts
export class InvalidShopifyOrderEventError extends Error
```

The event payload does not identify a valid order.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `message` | Which part of the payload is invalid. |

#### `isShopifyOrderEventTopic`

<sub>function</sub>

```ts
export function isShopifyOrderEventTopic(topic: string | null): topic is ShopifyOrderEventTopic
```

Narrows the `X-Shopify-Topic` header to a supported order-event topic.

| Parameter | Description |
| --- | --- |
| `topic` | Header value, or `null` when absent. |

**Returns:** `true` for `orders/updated` and `orders/edited`.

#### `parseShopifyOrderEvent`

<sub>function</sub>

```ts
export function parseShopifyOrderEvent(rawBody: string, topic: ShopifyOrderEventTopic): number
```

Extracts the order ID from an order-event payload.

- `orders/updated`: the payload is the order, so the ID is `id`.
- `orders/edited`: the payload is an order edit, so the ID is `order_edit.order_id`.

| Parameter | Description |
| --- | --- |
| `rawBody` | HMAC-verified raw body. |
| `topic` | Verified topic. |

**Returns:** A positive safe-integer order ID.

**Throws:** `InvalidShopifyOrderEventError` On invalid JSON or a missing/invalid ID.

### `lib/integrations/shopify/order`

Source: [`lib/integrations/shopify/order.ts`](../../lib/integrations/shopify/order.ts)

**Canonical Shopify order model and its validating parser.**

`ShopifyOrder` mirrors the REST webhook payload (`orders/create`). The Admin
GraphQL reader maps its responses into this same shape, so the domain layer
has a single input model regardless of how the order was obtained.

#### `ShopifyTaxLine`

<sub>type</sub>

```ts
export type ShopifyTaxLine = {
  /** Tax amount for the whole line (all units), decimal string. */
  price: string;
};
```

One tax line of a Shopify line item.

#### `ShopifyOrderLineItem`

<sub>type</sub>

```ts
export type ShopifyOrderLineItem = {
  id: number;
  /** `null` for custom or deleted products. */
  product_id: number | null;
  /** `null` for custom or deleted variants. */
  variant_id: number | null;
  sku: string | null;
  /** Current units. For Admin reads this is `currentQuantity` (after edits). */
  quantity: number;
  /** Unit price; tax-inclusive when the order's `taxes_included` is `true`. */
  price: string;
  /** Discount for the whole line. */
  total_discount: string;
  tax_lines: ShopifyTaxLine[];
};
```

A Shopify order line item (subset used by the integration).

#### `ShopifyOrder`

<sub>type</sub>

```ts
export type ShopifyOrder = {
  /** Numeric order ID. */
  id: number;
  /** Visible order name, e.g. `"#1047"`; Bigblue stores it as `external_id`. */
  name?: string;
  /** Shop currency. */
  currency?: string;
  /** Currency the customer paid in. */
  presentment_currency?: string;
  /** Total in the customer's currency. */
  presentment_total_price?: string;
  taxes_included?: boolean;
  /** Total in the shop currency; the reference amount Bigblue must match. */
  total_price?: string;
  created_at: string;
  line_items: ShopifyOrderLineItem[];
};
```

A Shopify order (subset used by the integration).

#### `InvalidShopifyOrderError`

<sub>class</sub>

```ts
export class InvalidShopifyOrderError extends Error
```

The webhook body (or mapped Admin response) is not a valid order.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `message` | Which field failed validation (never its value). |

#### `parseShopifyOrder`

<sub>function</sub>

```ts
export function parseShopifyOrder(rawBody: string): ShopifyOrder
```

Parses and validates a raw Shopify order JSON document.

Must only be called after the webhook HMAC has been verified on the same
raw string.

The presentment total is read from `total_price_set.presentment_money`
(REST webhook shape) or from the flat `presentment_total_price` (Admin
mapper shape); the flat field wins when both are present.

| Parameter | Description |
| --- | --- |
| `rawBody` | Raw JSON text. |

**Returns:** The validated order; optional fields are omitted when absent.

**Throws:** `InvalidShopifyOrderError` On invalid JSON or any invalid field.

### `lib/integrations/shopify/webhook-signature`

Source: [`lib/integrations/shopify/webhook-signature.ts`](../../lib/integrations/shopify/webhook-signature.ts)

**Authentication of inbound Shopify webhook deliveries.**

**See:** https://shopify.dev/docs/apps/build/webhooks/verify-deliveries

#### `verifyShopifyWebhook`

<sub>function</sub>

```ts
export function verifyShopifyWebhook(
  rawBody: string,
  providedHmac: string | null,
  secret: string,
): boolean
```

Verifies the `X-Shopify-Hmac-SHA256` header against the raw request body.

Must run on the exact bytes received, before JSON parsing. The comparison
is constant-time; a signature of the wrong length is rejected up front
(length is not secret: it is always 32 bytes for SHA-256).

| Parameter | Description |
| --- | --- |
| `rawBody` | Raw request body as received. |
| `providedHmac` | Base64 header value, or `null` when absent. |
| `secret` | Shopify app client secret. |

**Returns:** `true` only for a matching signature.

## Integration — Bigblue

### `lib/integrations/bigblue/client`

Source: [`lib/integrations/bigblue/client.ts`](../../lib/integrations/bigblue/client.ts)

**Minimal, dependency-free HTTP client for the Bigblue Store API.**

Responsibilities:
- Authenticate every call with the API key as a bearer token.
- Enforce a per-request timeout *and* an optional absolute deadline shared
  by all calls of one webhook delivery (Shopify requires a reply within 5 s).
- Normalise every failure into a {@link BigblueApiError} with an explicit
  `retryable` flag, so callers never need to inspect raw `fetch` errors.

It intentionally does not validate response bodies; that is the job of
`parsers.ts`, which turns `unknown` into typed objects.

#### `createBigblueClient`

<sub>function</sub>

```ts
export function createBigblueClient({
  apiKey,
  baseUrl = BIGBLUE_CONFIG.storeApiBaseUrl,
  deadlineAtMs,
  fetchImplementation = fetch,
  timeoutMs = BIGBLUE_CONFIG.defaultTimeoutMs,
}: BigblueClientOptions): BigblueRequest
```

Creates a Bigblue RPC function bound to one API key and time budget.

Retryability rules:
- HTTP `408`, `429` and `5xx` → retryable.
- Invalid JSON with `429`/`5xx` → retryable; otherwise permanent.
- Timeout, exhausted deadline or network failure → retryable.
- Any other non-2xx → permanent.

| Parameter | Description |
| --- | --- |
| `options` | API key, time budget and test overrides. |

**Returns:** A {@link BigblueRequest} that POSTs JSON to `<baseUrl>/<method>`.

**Example:**

```ts
const request = createBigblueClient({ apiKey, deadlineAtMs: Date.now() + 4_000 });
const raw = await request<ListOrdersRequest, unknown>("ListOrders", payload);
```

### `lib/integrations/bigblue/datetime`

Source: [`lib/integrations/bigblue/datetime.ts`](../../lib/integrations/bigblue/datetime.ts)

**Date formatting accepted by the Bigblue Store API.**

#### `formatBigblueDateTime`

<sub>function</sub>

```ts
export function formatBigblueDateTime(date: Date): string
```

Formats a date as an RFC 3339 UTC timestamp without milliseconds.

| Parameter | Description |
| --- | --- |
| `date` | Any valid `Date`. |

**Returns:** A timestamp such as `"2026-09-28T16:54:30Z"`.

### `lib/integrations/bigblue/errors`

Source: [`lib/integrations/bigblue/errors.ts`](../../lib/integrations/bigblue/errors.ts)

**Error taxonomy for the Bigblue integration.**

Route handlers map these classes to HTTP status codes and the `name` of each
class is written to logs as the failure `reason`. Both are part of the
operational contract: do not rename or duplicate these classes.

#### `BigblueApiError`

<sub>class</sub>

```ts
export class BigblueApiError extends Error
```

Transport-level or HTTP-level failure talking to the Bigblue Store API.

`retryable` drives the webhook response: retryable errors return `503` so
the sender redelivers; permanent ones return `502` (or `409` for `412`).

**Constructor:**

| Parameter | Description |
| --- | --- |
| `message` | Bigblue's error message, or a generic transport description. |
| `status` | HTTP status, or `null` for timeouts and network failures. |
| `code` | Bigblue error code, `"timeout"`, `"network_error"`, or `null`. |
| `retryable` | Whether repeating the same request may succeed. |
| `retryAfterMs` | Server-suggested back-off parsed from `Retry-After`. |

#### `InvalidBigblueResponseError`

<sub>class</sub>

```ts
export class InvalidBigblueResponseError extends Error
```

Bigblue answered, but the payload violates an invariant we rely on (shape,
totals, currency, or the update did not persist). Always treated as
retryable: the next delivery or reconciliation re-evaluates from scratch.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `message` | Diagnostic description. May include the Bigblue order ID. |

#### `BigblueOrderNotReadyError`

<sub>class</sub>

```ts
export class BigblueOrderNotReadyError extends Error
```

The Shopify order has not been imported into Bigblue yet. Expected right
after checkout; resolved by Shopify redelivery or the reconciliation cron.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `externalIds` | Every `external_id` that was searched for. |

### `lib/integrations/bigblue/order-search`

Source: [`lib/integrations/bigblue/order-search.ts`](../../lib/integrations/bigblue/order-search.ts)

**Locating the Bigblue copy of a Shopify order.**

Bigblue has no "get by external ID" endpoint, so the order is found by
listing a narrow creation-time window around the Shopify `created_at` and
matching `external_id` client-side.

#### `findBigblueOrder`

<sub>function</sub>

```ts
export async function findBigblueOrder(
  request: BigblueRequest,
  externalIds: string | readonly string[],
  createdAt: string,
): Promise<BigblueOrder | null>
```

Finds the Bigblue order whose `external_id` matches any of the given
Shopify references.

Several references are accepted because Bigblue currently stores the
visible Shopify order name (`"#1047"`) but may store the numeric ID if the
store integration is reconfigured. Matching is done on string form.

| Parameter | Description |
| --- | --- |
| `request` | Bigblue RPC function. |
| `externalIds` | One or more candidate `external_id` values. |
| `createdAt` | Shopify `created_at`, used to bound the search window. |

**Returns:** The first matching order, or `null` if Bigblue does not have it yet.

**Throws:** `BigblueApiError` On transport or HTTP failure.

**Throws:** `InvalidBigblueResponseError` On a malformed response or when the
pagination safety cap is exceeded.

#### `findBigblueOrderWithRetry`

<sub>function</sub>

```ts
export async function findBigblueOrderWithRetry(
  request: BigblueRequest,
  externalIds: string | readonly string[],
  createdAt: string,
  {
    delaysMs = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
  }: FindWithRetryOptions = {},
): Promise<BigblueOrder>
```

{@link findBigblueOrder} with bounded back-off for orders that Bigblue has
not imported yet and for retryable API errors.

Not used by the webhook routes, which must answer within Shopify's 5-second
limit and instead rely on Shopify redelivery plus the reconciliation cron.
Kept as a reusable primitive for longer-running callers.

| Parameter | Description |
| --- | --- |
| `request` | Bigblue RPC function. |
| `externalIds` | One or more candidate `external_id` values. |
| `createdAt` | Shopify `created_at`. |
| `options` | Back-off schedule and injectable sleep. |

**Returns:** The matching order.

**Throws:** `BigblueOrderNotReadyError` When every attempt finds nothing.

**Throws:** `BigblueApiError` Immediately on a non-retryable API error.

### `lib/integrations/bigblue/order-totals`

Source: [`lib/integrations/bigblue/order-totals.ts`](../../lib/integrations/bigblue/order-totals.ts)

**Reproduction of Bigblue's order `total` calculation, in cents.**

The integration refuses to write unless the Bigblue total it is about to
produce equals Shopify's total *to the cent*. That requires computing the
total exactly the way Bigblue does, before and after every update.

#### `calculateBigblueTotalCents`

<sub>function</sub>

```ts
export function calculateBigblueTotalCents(
  order: BigblueOrder,
  lineItems: readonly BigblueLineItem[] = order.line_items,
  additionalTaxOverride?: string,
): number | null
```

Computes a Bigblue order total in cents.

Formula (confirmed against live orders #1050–#1053, including a line
discount that Bigblue applies once per line, not per unit):

```text
total = shipping_price + shipping_tax + additional_tax − additional_discount
      + Σ line (quantity × (unit_price + unit_tax) − discount)
```

| Parameter | Description |
| --- | --- |
| `order` | Order whose header-level amounts are used. |
| `lineItems` | Lines to total; defaults to the order's own lines, but a *planned* set can be passed to preview the post-update total. |
| `additionalTaxOverride` | Replaces `order.additional_tax`, e.g. `"0.00"` to preview clearing a rounding residue. |

**Returns:** The total in cents, or `null` when any amount is missing/invalid.
`null` means "unverifiable" and must block the write.

#### `shouldClearRoundingAdditionalTax`

<sub>function</sub>

```ts
export function shouldClearRoundingAdditionalTax(
  order: BigblueOrder,
  plannedLineItems: readonly BigblueLineItem[],
  shopifyTotalPrice: string | undefined,
): boolean
```

Decides whether a ±1 cent `additional_tax` rounding residue should be
cleared as part of the update.

Bigblue sometimes imports Shopify orders with `additional_tax: "±0.01"` to
absorb its own rounding. Clearing it is allowed *only* when doing so makes
the planned total match Shopify exactly. No compensating cent is ever
invented to hide a mismatch.

| Parameter | Description |
| --- | --- |
| `order` | Current Bigblue order. |
| `plannedLineItems` | Lines that will be written. |
| `shopifyTotalPrice` | Shopify `total_price`. |

**Returns:** `true` when clearing the residue yields an exact match.

### `lib/integrations/bigblue/order-update`

Source: [`lib/integrations/bigblue/order-update.ts`](../../lib/integrations/bigblue/order-update.ts)

**Building and sending Bigblue `UpdateOrder` requests.**

`UpdateOrder` replaces the whole editable order, so the payload must carry
every editable field back unchanged. It is rebuilt from an explicit
allowlist: read-only response fields (`status`, `store`, `submit_time`,
`total`, tracking, packages, fulfillments…) are never echoed back.

#### `buildUpdateOrderPayload`

<sub>function</sub>

```ts
export function buildUpdateOrderPayload(
  order: BigblueOrder,
  lineItems: BigblueLineItem[],
  clearRoundingAdditionalTax = false,
): UpdateOrderPayload
```

Builds a full `UpdateOrder` payload from an existing order and new lines.

| Parameter | Description |
| --- | --- |
| `order` | Current Bigblue order, as returned by `ListOrders`. |
| `lineItems` | Replacement line items. |
| `clearRoundingAdditionalTax` | When `true`, sets `additional_tax` to `"0.00"` (see `shouldClearRoundingAdditionalTax`). |

**Returns:** The payload, containing only allowlisted fields.

#### `updateBigblueOrder`

<sub>function</sub>

```ts
export async function updateBigblueOrder(
  request: BigblueRequest,
  payload: UpdateOrderPayload,
): Promise<void>
```

Sends an `UpdateOrder` request. The response body is ignored: success is
established by re-reading the order afterwards, never by trusting the write.

| Parameter | Description |
| --- | --- |
| `request` | Bigblue RPC function. |
| `payload` | Payload from {@link buildUpdateOrderPayload}. |

**Returns:** Resolves when Bigblue accepts the request.

**Throws:** `BigblueApiError` When Bigblue rejects the request.

**Side effects:** Mutates the order in Bigblue.

### `lib/integrations/bigblue/parsers`

Source: [`lib/integrations/bigblue/parsers.ts`](../../lib/integrations/bigblue/parsers.ts)

**Runtime validation of Bigblue API responses.**

Bigblue responses are treated as untrusted input. These parsers check only
the fields the integration reads and preserve every other field untouched,
so a parsed order can be sent back through `UpdateOrder` without data loss.

#### `parseBigblueOrder`

<sub>function</sub>

```ts
export function parseBigblueOrder(value: unknown): BigblueOrder
```

Validates a Bigblue order returned by `ListOrders`.

| Parameter | Description |
| --- | --- |
| `value` | Raw order object. |

**Returns:** The order with validated `id`, `external_id` and `line_items`;
all other fields are passed through unchanged.

**Throws:** `InvalidBigblueResponseError` When a required field is missing or malformed.

#### `parseBigblueListOrdersResponse`

<sub>function</sub>

```ts
export function parseBigblueListOrdersResponse(
  value: unknown,
): ListOrdersResponse
```

Validates the envelope of a `ListOrders` response.

Individual orders are left as `unknown`: callers only parse the order they
are looking for, so one malformed unrelated order cannot break a lookup.

| Parameter | Description |
| --- | --- |
| `value` | Raw response body. |

**Returns:** The order list (empty when omitted) and the optional next page token.

**Throws:** `InvalidBigblueResponseError` When the envelope is malformed.

#### `readBigblueOrderStatusCode`

<sub>function</sub>

```ts
export function readBigblueOrderStatusCode(order: BigblueOrder): string | undefined
```

Reads the fulfillment status code of a Bigblue order (e.g. `"PENDING"`).

| Parameter | Description |
| --- | --- |
| `order` | A parsed Bigblue order. |

**Returns:** `order.status.code` when it is a string, otherwise `undefined`.

### `lib/integrations/bigblue/types`

Source: [`lib/integrations/bigblue/types.ts`](../../lib/integrations/bigblue/types.ts)

**Wire types for the subset of the Bigblue Store API we use.**

Bigblue objects carry many fields we neither read nor own. The types below
name the fields the integration depends on and keep the rest through an
index signature, so that round-tripping an order through `UpdateOrder`
never drops data Bigblue expects back.

Monetary fields are decimal strings (e.g. `"49.50"`).

**See:** https://bigblue.notion.site/Bigblue-Store-API-Documentation-4e9c3d052a1a4b73b59709edfe8b7457

#### `BigblueRequest`

<sub>type</sub>

```ts
export type BigblueRequest = <TRequest, TResponse>(
  method: string,
  payload: TRequest,
) => Promise<TResponse>;
```

Generic, transport-agnostic Bigblue RPC function.

Injected everywhere instead of a concrete client so that business logic can
be tested against an in-memory fake.

#### `BigblueLineItem`

<sub>type</sub>

```ts
export type BigblueLineItem = {
  /** Bigblue product reference, equal to the Shopify SKU. */
  product: string;
  /** Units to ship. Never sent as `0`: lines are removed instead. */
  quantity: number;
  /** Net unit price (tax excluded). */
  unit_price?: string;
  /** Tax per unit. */
  unit_tax?: string;
  /** Total discount for the whole line (not per unit). */
  discount?: string;
  [key: string]: unknown;
};
```

A logistics line of a Bigblue order.

#### `BigblueOrder`

<sub>type</sub>

```ts
export type BigblueOrder = {
  /** Bigblue order ID, e.g. `"MISSS1001047"`. */
  id: string;
  /** Shopify reference: currently the order name (`"#1047"`), possibly its numeric ID. */
  external_id: string | number;
  line_items: BigblueLineItem[];
  [key: string]: unknown;
};
```

A Bigblue order as returned by `ListOrders`.

#### `ListOrdersRequest`

<sub>type</sub>

```ts
export type ListOrdersRequest = {
  /** Creation-time window, formatted with `formatBigblueDateTime`. */
  date_range: {
    from: string;
    to: string;
  };
  /** Empty string for the first page. */
  page_token: string;
  page_size: number;
};
```

Request body of `ListOrders`.

#### `ListOrdersResponse`

<sub>type</sub>

```ts
export type ListOrdersResponse = {
  orders: unknown[];
  next_page_token?: string;
};
```

Validated response of `ListOrders`. Orders stay `unknown` until parsed individually.

#### `UpdateOrderPayload`

<sub>type</sub>

```ts
export type UpdateOrderPayload = {
  order: Record<string, unknown> & {
    id: string;
    external_id: string | number;
    line_items: BigblueLineItem[];
  };
};
```

Request body of `UpdateOrder`: Bigblue requires the full editable order.

### `lib/integrations/bigblue/webhook-signature`

Source: [`lib/integrations/bigblue/webhook-signature.ts`](../../lib/integrations/bigblue/webhook-signature.ts)

**Authentication of inbound Bigblue webhook deliveries.**

#### `verifyBigblueWebhookHmac`

<sub>function</sub>

```ts
export function verifyBigblueWebhookHmac(
  rawBody: string,
  providedHmac: string | null,
  sharedSecret: string,
): boolean
```

Verifies the `X-Bigblue-Hmac-SHA256` header against the raw request body.

Must be called with the exact bytes received, *before* JSON parsing, since
re-serialising would change the signed content.

| Parameter | Description |
| --- | --- |
| `rawBody` | Raw request body as received. |
| `providedHmac` | Base64 signature header value, or `null` if absent. |
| `sharedSecret` | Bigblue app *Shared secret* (`BIGBLUE_WEBHOOK_KEY`). |

**Returns:** `true` only for a well-formed, matching signature (constant-time comparison).

#### `isBigblueUrlVerificationBody`

<sub>function</sub>

```ts
export function isBigblueUrlVerificationBody(rawBody: string): boolean
```

Recognises Bigblue's URL-verification handshake body: exactly
`{"challenge": "<non-empty string>"}` and nothing else.

The strict shape check matters because the route echoes this body back
verbatim; it must never reflect arbitrary content.

| Parameter | Description |
| --- | --- |
| `rawBody` | Raw request body. |

**Returns:** `true` when the body is a well-formed, bounded challenge.

### `lib/integrations/bigblue/webhook-url-token`

Source: [`lib/integrations/bigblue/webhook-url-token.ts`](../../lib/integrations/bigblue/webhook-url-token.ts)

**Scoped bearer token embedded in the private Bigblue webhook URL.**

Bigblue's dashboard only asks for a target URL. To allow authenticated
`GET` health probes of the receiver without exposing the reusable Bigblue
secret, we put a *derived* token in the URL instead: an HMAC of a fixed,
versioned context string. Leaking the URL therefore leaks only this token,
which cannot be used to sign webhooks.

#### `deriveBigblueWebhookUrlToken`

<sub>function</sub>

```ts
export function deriveBigblueWebhookUrlToken(webhookKey: string): string
```

Derives the URL token from the webhook key.

| Parameter | Description |
| --- | --- |
| `webhookKey` | `BIGBLUE_WEBHOOK_KEY`. |

**Returns:** A 64-character lowercase hex token.

#### `verifyBigblueWebhookUrlToken`

<sub>function</sub>

```ts
export function verifyBigblueWebhookUrlToken(
  suppliedToken: string | null,
  webhookKey: string,
): boolean
```

Verifies a token taken from the `?token=` query parameter.

| Parameter | Description |
| --- | --- |
| `suppliedToken` | Untrusted token from the request URL, or `null`. |
| `webhookKey` | `BIGBLUE_WEBHOOK_KEY`. |

**Returns:** `true` only for the exact derived token (constant-time comparison).

## Health

### `lib/health/check-integration-health`

Source: [`lib/health/check-integration-health.ts`](../../lib/health/check-integration-health.ts)

**Live connectivity checks behind `GET /api/health`.**

Probes Bigblue and Shopify with cheap read-only requests and validates the
local product configuration. Results are cached for 30 seconds and
concurrent callers share one in-flight run, so the public endpoint cannot be
used to amplify traffic towards the upstream APIs.

#### `checkIntegrationHealth`

<sub>function</sub>

```ts
export async function checkIntegrationHealth(): Promise<IntegrationHealth>
```

Returns the integration health, cached for 30 s and single-flighted.

**Returns:** The current (possibly cached) health report; never rejects.

### `lib/health/types`

Source: [`lib/health/types.ts`](../../lib/health/types.ts)

**Public contract of `GET /api/health`.**

Shared by the server check and the client status widget. Contains no
secrets: `detail` strings are user-facing (Spanish) and never include
credentials or raw upstream errors.

#### `IntegrationCheck`

<sub>type</sub>

```ts
export type IntegrationCheck = {
  /** Stable check identifier, used as React key. */
  id: "bigblue" | "shopify" | "products";
  /** Display name. */
  label: string;
  status: "ok" | "error";
  /** Human-readable explanation shown in the status tooltip. */
  detail: string;
};
```

Result of one integration check.

#### `IntegrationHealth`

<sub>type</sub>

```ts
export type IntegrationHealth = {
  /** `"ok"` only when every check is `"ok"`. */
  status: "ok" | "error";
  /** ISO timestamp of when the checks ran (may be up to 30 s old: cached). */
  checkedAt: string;
  checks: IntegrationCheck[];
};
```

Aggregated health report.

## Observability

### `lib/observability/integration-log`

Source: [`lib/observability/integration-log.ts`](../../lib/observability/integration-log.ts)

**Structured, allow-listed integration logging.**

Every log line is `console.<level>("bigblue_subscription_adjustment", { event, ...context })`.
Hosting platforms (Vercel) index the JSON payload, so operators can filter
and alert on `event` and on the level. Both are an operational contract:
adding an event is safe, renaming one or changing its level breaks alerts.

Privacy rule: contexts carry IDs, SKUs, quantities, amounts and error class
names only. Never log customer data, addresses, raw payloads or secrets.

#### `IntegrationEvent`

<sub>type</sub>

```ts
export type IntegrationEvent = keyof typeof EVENT_LEVELS;
```

Name of a known integration event.

#### `LogContext`

<sub>type</sub>

```ts
export type LogContext = Record<string, LogValue>;
```

Additional structured fields attached to an event.

#### `logIntegrationEvent`

<sub>function</sub>

```ts
export function logIntegrationEvent(
  event: IntegrationEvent,
  context: LogContext = {},
): void
```

Emits one structured integration event at its catalogued severity.

| Parameter | Description |
| --- | --- |
| `event` | Event name from the catalogue. |
| `context` | Log-safe structured fields (see the privacy rule above). |

**Returns:** Nothing.

**Side effects:** Writes one line to `console.info`, `console.warn` or `console.error`.

**Example:**

```ts
logIntegrationEvent("bigblue_not_ready", { shopifyOrderId: "8212586266951" });
```

## Shared utilities

### `lib/shared/async`

Source: [`lib/shared/async.ts`](../../lib/shared/async.ts)

**Small asynchronous primitives.**

#### `sleep`

<sub>function</sub>

```ts
export function sleep(milliseconds: number): Promise<void>
```

Resolves after the given number of milliseconds.

Injected as a dependency wherever code waits, so tests can replace it with
an instant fake and run deterministically.

| Parameter | Description |
| --- | --- |
| `milliseconds` | Delay before the promise resolves. |

**Returns:** A promise that resolves with `undefined`.

### `lib/shared/crypto`

Source: [`lib/shared/crypto.ts`](../../lib/shared/crypto.ts)

**Constant-time secret comparison.**

#### `secretsMatch`

<sub>function</sub>

```ts
export function secretsMatch(supplied: string, expected: string): boolean
```

Compares two secrets in constant time, regardless of their lengths.

Both inputs are hashed with SHA-256 first so that `timingSafeEqual` always
receives equal-length buffers. This prevents leaking the expected secret's
length through an early length-mismatch return.

| Parameter | Description |
| --- | --- |
| `supplied` | Untrusted value received from the caller. |
| `expected` | Trusted secret loaded from configuration. |

**Returns:** `true` only when both strings are identical.

### `lib/shared/errors`

Source: [`lib/shared/errors.ts`](../../lib/shared/errors.ts)

**Error helpers safe for structured logging.**

#### `describeErrorForLog`

<sub>function</sub>

```ts
export function describeErrorForLog(error: unknown): string
```

Returns a log-safe identifier for a caught error.

Only the error class name is exposed (e.g. `"BigblueApiError"`), never the
message, because messages may contain customer or order data. Operators
filter on these names, so error classes must keep their `name` stable.

| Parameter | Description |
| --- | --- |
| `error` | Any value caught in a `catch` clause. |

**Returns:** The error's `name`, or `"unknown_error"` for non-`Error` throwables.

### `lib/shared/guards`

Source: [`lib/shared/guards.ts`](../../lib/shared/guards.ts)

**Runtime type guards for untrusted, already-deserialized JSON.**

Every payload that crosses a process boundary (webhook bodies, third-party
API responses) is typed as `unknown` and narrowed with these guards before
any field is read. They are deliberately minimal and side-effect free.

#### `isRecord`

<sub>function</sub>

```ts
export function isRecord(value: unknown): value is Record<string, unknown>
```

Narrows a value to a plain JSON object (a non-null, non-array object).

| Parameter | Description |
| --- | --- |
| `value` | Any value, typically the output of `JSON.parse`. |

**Returns:** `true` when `value` can be safely indexed by string keys.

**Example:**

```ts
const body: unknown = JSON.parse(raw);
if (isRecord(body) && typeof body.id === "string") {
  // body.id is a string here
}
```

### `lib/shared/money`

Source: [`lib/shared/money.ts`](../../lib/shared/money.ts)

**Exact monetary arithmetic helpers.**

All money comparisons in the integration are performed on integer cents to
avoid IEEE-754 drift (`0.1 + 0.2 !== 0.3`). Amounts arrive as decimal
strings from Shopify and Bigblue and are converted exactly once, at the edge
of each calculation.

#### `toCents`

<sub>function</sub>

```ts
export function toCents(value: unknown): number | null
```

Converts a monetary amount to integer cents.

Accepts finite numbers and strings in plain decimal notation with at most
two fractional digits (e.g. `"12"`, `"-0.01"`, `"49.50"`). Negative values
are allowed because Bigblue reports rounding corrections such as
`additional_tax: "-0.01"`.

| Parameter | Description |
| --- | --- |
| `value` | Amount as received from an API (string or number). |

**Returns:** The amount in cents, or `null` when the input is not a valid,
safely representable amount. Callers must treat `null` as "unverifiable"
and refuse to write.

**Example:**

```ts
toCents("49.50"); // 4950
toCents("1.005"); // null (more than two decimals)
toCents(undefined); // null
```

#### `formatMoney`

<sub>function</sub>

```ts
export function formatMoney(value: number): string
```

Formats an amount expressed in major units as a two-decimal string.

| Parameter | Description |
| --- | --- |
| `value` | Amount in major units (e.g. euros), not cents. |

**Returns:** The amount formatted as Bigblue expects, e.g. `"49.50"`.

## Configuration

### `config/bigblue`

Source: [`config/bigblue.ts`](../../config/bigblue.ts)

**Static Bigblue Store API configuration (no secrets).**

#### `BIGBLUE_CONFIG`

<sub>const</sub>

```ts
export const BIGBLUE_CONFIG = {
  /** RPC-style base URL; the method name is appended as the last path segment. */
  storeApiBaseUrl: "https://api.bigblue.co/bigblue.storeapi.v1.PublicAPI",
  /** Default per-request timeout. Webhooks additionally pass a shared deadline. */
  defaultTimeoutMs: 2_000,
} as const;
```

Bigblue Store API settings.

### `config/fulfillment-settings`

Source: [`config/fulfillment-settings.ts`](../../config/fulfillment-settings.ts)

**Global switches for how the Bigblue logistics copy is rewritten.**

These settings only affect fulfillment in Bigblue. Shopify orders, SKUs,
prices, taxes and discounts are never modified.

#### `FulfillmentSettings`

<sub>type</sub>

```ts
export type FulfillmentSettings = {
  /**
   * When `true`, the experience SKU is always shipped as its explicitly
   * configured `experience.replacement` SKU (see
   * `config/subscription-product-pairs.ts`). When `false`, the original
   * experience SKU is kept.
   */
  replaceExperienceSku: boolean;
};
```

Feature flags that shape the Bigblue line-item adjustment.

#### `FULFILLMENT_SETTINGS`

<sub>const</sub>

```ts
export const FULFILLMENT_SETTINGS: FulfillmentSettings = {
  replaceExperienceSku: true,
};
```

Production fulfillment settings.

### `config/server-env`

Source: [`config/server-env.ts`](../../config/server-env.ts)

**Typed, validated access to server-side secrets and environment.**

This is the only module that reads `process.env` at runtime. Values are read
lazily on every call (never cached at import time) so that a missing secret
surfaces as a handled error inside the request that needs it, instead of
crashing the whole deployment at boot.

The `server-only` import makes any accidental client-side import a build
error, guaranteeing secrets never reach the browser bundle.

#### `EnvironmentConfigurationError`

<sub>class</sub>

```ts
export class EnvironmentConfigurationError extends Error
```

Raised when a required variable is missing, empty or malformed.

The message lists variable *names* only, never values.

**Constructor:**

| Parameter | Description |
| --- | --- |
| `variableNames` | Accepted names for the missing setting, in priority order. |

#### `getShopifyWebhookSecret`

<sub>function</sub>

```ts
export function getShopifyWebhookSecret(): string
```

Shopify app client secret used to verify `X-Shopify-Hmac-SHA256`.

**Returns:** The webhook signing secret.

**Throws:** `EnvironmentConfigurationError` When neither `SHOPIFY_WEBHOOK_SECRET`
nor the legacy `SHOPIFY_WEBHOOK_KEY` is set.

#### `getShopifyPrivateAccessToken`

<sub>function</sub>

```ts
export function getShopifyPrivateAccessToken(): string
```

Private Storefront API token, used only by the server-side health check.

**Returns:** The private Storefront token.

**Throws:** `EnvironmentConfigurationError` When `SHOPIFY_PRIVATE_ACCESS_TOKEN` is unset.

#### `getShopifyPublicAccessToken`

<sub>function</sub>

```ts
export function getShopifyPublicAccessToken(): string
```

Public Storefront API token. Reserved for future client-side use; the
current integration does not need it.

**Returns:** The public Storefront token.

**Throws:** `EnvironmentConfigurationError` When `SHOPIFY_PUBLIC_ACCESS_TOKEN` is unset.

#### `getShopifyStoreDomain`

<sub>function</sub>

```ts
export function getShopifyStoreDomain(): string
```

Storefront hostname used by the health check.

Falls back to {@link SHOPIFY_CONFIG.defaultStoreDomain}. Accepts either a
bare hostname or an `https://` origin.

**Returns:** The validated hostname, without scheme or path.

**Throws:** `EnvironmentConfigurationError` When the value is not a bare HTTPS origin.

**Throws:** `TypeError` When the value cannot be parsed as a URL at all.

#### `getBigblueApiKey`

<sub>function</sub>

```ts
export function getBigblueApiKey(): string
```

Bearer token for outbound Bigblue Store API requests.

**Returns:** The Bigblue API key.

**Throws:** `EnvironmentConfigurationError` When `BIGBLUE_API_KEY` is unset.

#### `getBigblueWebhookKey`

<sub>function</sub>

```ts
export function getBigblueWebhookKey(): string
```

Bigblue app *Shared secret*: verifies webhook HMACs and derives the optional
private webhook URL token.

**Returns:** The Bigblue webhook key.

**Throws:** `EnvironmentConfigurationError` When `BIGBLUE_WEBHOOK_KEY` is unset.

#### `getShopifyAdminAccessToken`

<sub>function</sub>

```ts
export function getShopifyAdminAccessToken(): string
```

Admin GraphQL token with the `read_orders` scope (not the Storefront token).

**Returns:** The Admin API access token.

**Throws:** `EnvironmentConfigurationError` When neither `SHOPIFY_ACCESS_TOKEN`
nor `SHOPIFY_ADMIN_ACCESS_TOKEN` is set.

#### `getShopifyAdminStoreDomain`

<sub>function</sub>

```ts
export function getShopifyAdminStoreDomain(): string
```

Permanent `*.myshopify.com` hostname for Admin API calls and webhook
shop-domain checks.

Prefers `SHOPIFY_ADMIN_STORE_DOMAIN`, falling back to `SHOPIFY_STORE_DOMAIN`
when that already is the permanent hostname. The value is validated strictly
because it is interpolated into the request URL that carries the Admin
token: anything other than a bare `https://<shop>.myshopify.com` origin is
rejected.

**Returns:** The validated `*.myshopify.com` hostname.

**Throws:** `EnvironmentConfigurationError` When unset or not a bare myshopify origin.

#### `getReconciliationCronSecret`

<sub>function</sub>

```ts
export function getReconciliationCronSecret(): string
```

Bearer secret the external scheduler must send to the reconciliation cron.

**Returns:** The cron secret.

**Throws:** `EnvironmentConfigurationError` When `RECONCILIATION_CRON_SECRET` is unset.

### `config/shopify`

Source: [`config/shopify.ts`](../../config/shopify.ts)

**Static Shopify API configuration (no secrets).**

#### `SHOPIFY_CONFIG`

<sub>const</sub>

```ts
export const SHOPIFY_CONFIG = {
  /** Public storefront domain used when `SHOPIFY_STORE_DOMAIN` is not set. */
  defaultStoreDomain: "missence.com",
  /** Storefront API version used by the live health check. */
  storefrontApiVersion: "2026-07",
  /** Admin GraphQL API version used to read current order state. */
  adminApiVersion: "2026-07",
} as const;
```

Versioned Shopify API settings shared by every Shopify call.

#### `getShopifyStorefrontGraphqlUrl`

<sub>function</sub>

```ts
export function getShopifyStorefrontGraphqlUrl(storeDomain: string): string
```

Builds the Storefront GraphQL endpoint for a store.

| Parameter | Description |
| --- | --- |
| `storeDomain` | Bare hostname, e.g. `missence.com`. |

**Returns:** The absolute HTTPS GraphQL endpoint.

#### `getShopifyAdminGraphqlUrl`

<sub>function</sub>

```ts
export function getShopifyAdminGraphqlUrl(storeDomain: string): string
```

Builds the Admin GraphQL endpoint for a store.

| Parameter | Description |
| --- | --- |
| `storeDomain` | Permanent `*.myshopify.com` hostname. |

**Returns:** The absolute HTTPS Admin GraphQL endpoint.

### `config/site`

Source: [`config/site.ts`](../../config/site.ts)

**Public site metadata and brand assets.**

Safe to import from client components: contains no secrets.

#### `SITE_CONFIG`

<sub>const</sub>

```ts
export const SITE_CONFIG = {
  name: "MISSENCE",
  title: "MISSENCE Subscriptions",
  description: "Gestión de suscripciones de MISSENCE.",
  brand: {
    /** Horizontal wordmark served from `public/`. */
    logo: "/brand/logo_long.webp",
    /** Square brand mark used as favicon and decorative accent. */
    mark: "/brand/logo.png",
  },
  developer: {
    githubUsername: "zeroxydev",
    githubUrl: "https://github.com/zeroxydev",
    /** Remote avatar; its origin is allow-listed in `next.config.ts`. */
    avatarUrl: "https://github.com/zeroxydev.png",
  },
} as const;
```

Branding and attribution shown on the operations landing page.

### `config/subscription-product-pairs`

Source: [`config/subscription-product-pairs.ts`](../../config/subscription-product-pairs.ts)

**Catalogue of subscription/experience product pairs.**

A *pair* links a recurring subscription product with the one-off
"experience" product that Shopify adds only to the initial checkout (or to a
resubscription). Seeing both products in the same order is what identifies a
first shipment.

Every identifier is explicit. Replacements are never inferred from naming
patterns such as the `-UP` suffix: SKU, product ID and variant ID may differ
for each pair.

#### `SubscriptionProductPair`

<sub>type</sub>

```ts
export type SubscriptionProductPair = {
  /** Stable identifier used in logs and adjustment results. */
  id: string;
  /** Recurring product whose units are partly shipped inside the experience. */
  subscription: ConfiguredProduct;
  /** First-shipment product, plus the SKU Bigblue must ship instead of it. */
  experience: ConfiguredProduct & {
    /** Physical SKU that replaces the experience in the Bigblue logistics copy. */
    replacement: ConfiguredProduct;
  };
};
```

A subscription product and the experience product that marks its first shipment.

#### `PRODUCT_PAIRS`

<sub>const</sub>

```ts
export const PRODUCT_PAIRS = [
  {
    id: "MISS_0002_0004",
    subscription: {
      sku: "MISS-000000-0002",
      productId: 10791019643207,
      variantId: 53887845564743,
    },
    experience: {
      sku: "MISS-000000-0004-UP",
      productId: 10987479859527,
      variantId: 54579708854599,
      replacement: {
        sku: "MISS-000000-0004",
        productId: 10897754554695,
        variantId: 54311286243655,
      },
    },
  },
  {
    id: "MISS_0001_0003",
    subscription: {
      sku: "MISS-000000-0001",
      productId: 10790886310215,
      variantId: 54328475517255,
    },
    experience: {
      sku: "MISS-000000-0003-UP",
      productId: 10987460002119,
      variantId: 54579583025479,
      replacement: {
        sku: "MISS-000000-0003",
        productId: 10897753637191,
        variantId: 54311284736327,
      },
    },
  },
] as const satisfies readonly SubscriptionProductPair[];
```

Production pair catalogue.

Detection iterates in this order and stops at the first match, so the order
of entries is significant if a single checkout could ever match two pairs.

#### `ProductPairId`

<sub>type</sub>

```ts
export type ProductPairId = (typeof PRODUCT_PAIRS)[number]["id"];
```

Union of the configured pair identifiers, e.g. `"MISS_0002_0004"`.

## Tooling scripts

### `scripts/bigblue-dry-run`

Source: [`scripts/bigblue-dry-run.ts`](../../scripts/bigblue-dry-run.ts)

**Read-only smoke test of the detection rules and the Bigblue API.**

Run with `pnpm dry-run:bigblue` (or `pnpm missence dry-run`). It:
1. checks every configured pair is detected on a synthetic first-shipment
   order and is *not* triggered by a renewal;
2. authenticates against Bigblue and fetches one `ListOrders` page;
3. validates the shape of one real order with the production parser.

Strictly read-only: it never calls `UpdateOrder` and never prints order data.

_No exports (entry point or side-effect module)._

### `scripts/docs/cli`

Source: [`scripts/docs/cli.ts`](../../scripts/docs/cli.ts)

**Command-line entry point of the documentation engine.**

```bash
pnpm docs:check     # validate the standard + verify the reference is fresh
pnpm docs:generate  # regenerate docs/reference/api.md
```

`docs:check` is part of `pnpm check`, so undocumented code or a stale
reference fails CI exactly like a type error.

_No exports (entry point or side-effect module)._

### `scripts/docs/render-reference`

Source: [`scripts/docs/render-reference.ts`](../../scripts/docs/render-reference.ts)

**Renders the generated API reference (`docs/reference/api.md`).**

The output is deterministic (stable ordering, no timestamps) so that the
freshness check can compare it byte-for-byte with the committed file.

#### `renderReference`

<sub>function</sub>

```ts
export function renderReference(modules: readonly DocModule[]): string
```

Renders the complete API reference document.

| Parameter | Description |
| --- | --- |
| `modules` | Every docModule model. |

**Returns:** The Markdown document.

### `scripts/docs/rules`

Source: [`scripts/docs/rules.ts`](../../scripts/docs/rules.ts)

**Validation rules of the MISSENCE Documentation Standard (MDS).**

Each rule has a stable code so violations are easy to search for and to
reference from `docs/standards/documentation.md`.

#### `ALLOWED_TAGS`

<sub>const</sub>

```ts
export const ALLOWED_TAGS = new Set([
  "file",
  "module",
  "param",
  "returns",
  "throws",
  "example",
  "see",
  "remarks",
  "invariant",
  "sideEffects",
  "typeParam",
  "deprecated",
]);
```

Every JSDoc tag allowed by the standard. Anything else is a typo or drift.

#### `DocViolation`

<sub>type</sub>

```ts
export type DocViolation = {
  /** Stable rule code, e.g. `MDS003`. */
  code: string;
  /** Repository-relative file path. */
  filePath: string;
  /** 1-based line, when the violation is tied to a declaration. */
  line: number | null;
  message: string;
};
```

A single standard violation.

#### `validateModule`

<sub>function</sub>

```ts
export function validateModule(docModule: DocModule): DocViolation[]
```

Validates one docModule against the standard.

Rules:
- `MDS001` file header with `@file` and a summary is required.
- `MDS002` `@module` must equal the file path without extension.
- `MDS003` every symbol that requires documentation has a JSDoc summary.
- `MDS004` every parameter is documented with `@param`.
- `MDS005` no `@param` for a non-existent parameter.
- `MDS006` every function documents `@returns`.
- `MDS007` only tags from {@link ALLOWED_TAGS} are used.
- `MDS008` constructors with parameters document them.

| Parameter | Description |
| --- | --- |
| `docModule` | Module model. |

**Returns:** Violations, empty when compliant.

### `scripts/docs/source-model`

Source: [`scripts/docs/source-model.ts`](../../scripts/docs/source-model.ts)

**Source discovery and documentation model extraction.**

Parses every documented source file with the TypeScript compiler (syntax
only, no type-checking, so it is fast and works on `.mjs` too) and builds a
{@link DocModule} per file: its header block and its top-level symbols with
their JSDoc. Both the validator and the reference renderer consume this
model, so they can never disagree about what the code says.

#### `DocTag`

<sub>type</sub>

```ts
export type DocTag = {
  /** Tag name without `@`, e.g. `param`. */
  name: string;
  /** Free text after the tag (and after the parameter name / type, when present). */
  text: string;
  /** Parameter name for `@param` tags. */
  paramName?: string;
  /** `{Type}` expression for `@throws` and typed JS tags. */
  type?: string;
};
```

One JSDoc block tag, e.g. `@param value - The value`.

#### `DocBlock`

<sub>type</sub>

```ts
export type DocBlock = {
  /** Description before the first tag. */
  summary: string;
  tags: DocTag[];
};
```

A parsed JSDoc block.

#### `SymbolKind`

<sub>type</sub>

```ts
export type SymbolKind = "function" | "class" | "type" | "interface" | "enum" | "const";
```

Kind of a top-level declaration.

#### `DocParameter`

<sub>type</sub>

```ts
export type DocParameter = {
  /** Identifier name, or `null` for a destructured binding pattern. */
  name: string | null;
};
```

A function-like parameter as seen by the validator.

#### `DocSymbol`

<sub>type</sub>

```ts
export type DocSymbol = {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  /** 1-based line of the declaration. */
  line: number;
  /** Declaration text without its body, for the reference. */
  signature: string;
  /** JSDoc attached to the declaration (the file header is never counted). */
  doc: DocBlock | null;
  /** Parameters, for functions and arrow-function constants. */
  params: DocParameter[] | null;
  /** Constructor parameters and JSDoc, for classes. */
  constructorInfo: { params: DocParameter[]; doc: DocBlock | null; line: number } | null;
  /** Whether the documentation standard requires this symbol to be documented. */
  requiresDoc: boolean;
};
```

A top-level declaration and its documentation.

#### `DocModule`

<sub>type</sub>

```ts
export type DocModule = {
  /** Repository-relative POSIX path, e.g. `lib/shared/money.ts`. */
  filePath: string;
  /** Expected `@module` id: the path without extension. */
  expectedModuleId: string;
  /** The first `/** … *\/` block of the file, when it carries `@file`. */
  header: DocBlock | null;
  symbols: DocSymbol[];
};
```

A source file and its documentation model.

#### `discoverSourceFiles`

<sub>function</sub>

```ts
export function discoverSourceFiles(root: string): string[]
```

Lists every file covered by the documentation standard, sorted.

| Parameter | Description |
| --- | --- |
| `root` | Repository root. |

**Returns:** Repository-relative POSIX paths.

#### `loadModule`

<sub>function</sub>

```ts
export function loadModule(root: string, filePath: string): DocModule
```

Builds the documentation model of one file.

| Parameter | Description |
| --- | --- |
| `root` | Repository root. |
| `filePath` | Repository-relative POSIX path. |

**Returns:** The module model.

#### `loadProject`

<sub>function</sub>

```ts
export function loadProject(root: string): DocModule[]
```

Loads the documentation model of the whole repository.

| Parameter | Description |
| --- | --- |
| `root` | Repository root. |

**Returns:** One model per documented source file.

### `scripts/missence`

Source: [`scripts/missence.ts`](../../scripts/missence.ts)

**`pnpm missence` — interactive project task runner.**

Wraps the package scripts in a menu (or runs one directly, e.g.
`pnpm missence check`) using whichever package manager invoked it.

_No exports (entry point or side-effect module)._

### `scripts/print-bigblue-webhook-url`

Source: [`scripts/print-bigblue-webhook-url.mjs`](../../scripts/print-bigblue-webhook-url.mjs)

**Prints the private Bigblue webhook URL (with its derived `?token=`).**

Usage:

```bash
node --env-file=.env --import tsx scripts/print-bigblue-webhook-url.mjs https://missence.vercel.app
```

The printed URL is a secret: anyone holding it can probe the receiver.
It never contains `BIGBLUE_WEBHOOK_KEY` itself, only a derived token.

_No exports (entry point or side-effect module)._

## Root configuration

### `eslint.config`

Source: [`eslint.config.mjs`](../../eslint.config.mjs)

**ESLint configuration, including machine-enforced architecture layers.**

Dependency direction (an arrow means "may import"):

  app ─► lib/http ─► lib/subscriptions/application ─► lib/subscriptions/domain
                                  │                          │
                                  ▼                          ▼
                         lib/integrations/* ──────────► lib/shared
                                  │
                                  ▼
                   config, lib/observability

See docs/architecture/layers.md for the rationale of every rule below.

_No exports (entry point or side-effect module)._

### `next.config`

Source: [`next.config.ts`](../../next.config.ts)

**Next.js configuration.**

_No exports (entry point or side-effect module)._

### `postcss.config`

Source: [`postcss.config.mjs`](../../postcss.config.mjs)

**PostCSS configuration: enables Tailwind CSS v4.**

_No exports (entry point or side-effect module)._
