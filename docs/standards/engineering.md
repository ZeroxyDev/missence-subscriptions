# Engineering standards

Conventions every change is expected to follow. Most are enforced by
`pnpm check`; the rest are checked in review.

## Quality gate

```bash
pnpm check   # next typegen → tsc → eslint (incl. architecture) → tests → docs:check
pnpm build   # final validation before release
```

A change is mergeable only when `pnpm check` and `pnpm build` pass.

## TypeScript

- `strict` mode. No `any`; untrusted data is `unknown` and narrowed with
  guards (`isRecord`) or parsers that throw a typed error.
- Discriminated unions for outcomes (`{ kind: "ignored" } | { kind: "processed", … }`),
  exhaustive `switch` at the edges.
- `readonly` inputs where the function does not mutate.
- Imports use the `@/` alias; `import type` for type-only imports.

## Errors

- One class per failure category, with a stable `name`. The name is logged
  as `reason` and routes branch on `instanceof`, so **never rename or
  duplicate an error class**.
- Error messages name fields and IDs, never values from customer data.
- Transient conditions are retryable (`503`); permanent ones are `4xx`/`502`.

## Money

- Compare and add amounts only as integer cents (`toCents`).
- `null` from a money conversion means "unverifiable": never write on it.
- Never introduce compensating amounts to make totals match. See
  [ADR-0003](../adr/0003-exact-money-verification.md).

## External calls

- Every outbound request has a timeout; webhook paths share an absolute
  deadline (`deadlineAtMs`).
- `cache: "no-store"` on every API call.
- Inject `fetch`/clients as parameters so logic is testable without a network.
- Verify writes by reading back; never trust a `2xx` alone.

## Logging

- Only through `logIntegrationEvent`, with events from the catalogue.
- Adding an event: add it to `EVENT_LEVELS` with a deliberate level and to the
  runbook table. Renaming an event or changing its level is a breaking change
  for alerting.

## Testing

- Pure logic: unit tests with plain data.
- Endpoints: route characterization tests pin status, body,
  `Cache-Control` and the ordered `[level, event]` log sequence
  ([`tests/support/route-harness.ts`](../../tests/support/route-harness.ts)).
- `tests/` mirrors the source tree, one test file per module:

  ```text
  tests/
    app/api/…                 route characterization tests (one file per endpoint)
    subscriptions/domain/     pure business rules
    subscriptions/application/ use cases with in-memory Bigblue fakes
    integrations/{bigblue,shopify}/ parsers, clients, webhook verification
    observability/            log severity contract
    shared/                   utilities
    support/                  harness and fakes (not test suites; outside the glob)
  ```

  The runner glob is `tests/**/*.test.ts`; import support code with `@/tests/support/…`.
- Tests run with `--conditions=react-server` so `server-only` modules load.

## Components

- `components/ui/` holds generic primitives with no domain knowledge; ESLint
  forbids them from importing config, `lib/` or feature components.
- Feature components live in a folder per feature; a client feature splits
  data fetching (a `use…` hook) from presentation.
- Pages in `app/` only compose components.
- Keep `"use client"` at the smallest boundary possible.

### Design tokens

- The MISSENCE palette, radii and widths are CSS custom properties on `:root`
  in [`app/globals.css`](../../app/globals.css) and exposed to Tailwind v4
  through `@theme inline` as `missence-*` utilities (`bg-missence-accent`,
  `text-missence-muted`, `rounded-missence-sm`, …). Use the utilities, never
  raw hex values.
- Pink (`missence-accent`) is reserved for status and functional signals;
  greys, black and borders carry the structure. The interface is an internal,
  minimal, responsive tool and must not look like a storefront.
- Brand assets are served from `public/brand/` and referenced through
  `SITE_CONFIG.brand`.

## Next.js

This project uses Next.js 16. Read the bundled docs in
`node_modules/next/dist/docs/` before using an API you have not used here.
Route segment config (`runtime`, `maxDuration`, `dynamic`) must be literal
exports in each route file.

## Commits and reviews

- One logical change per commit; behaviour changes come with tests.
- Structural changes come with an ADR.
- Regenerate the API reference (`pnpm docs:generate`) when a documented API changes.
