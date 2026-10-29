# 0006. Layered architecture and machine-enforced documentation

- Status: Accepted
- Date: 2026-10-08

## Context

The codebase had grown around vendor folders (`lib/bigblue`, `lib/shopify`,
`lib/subscriptions`). Business rules, Bigblue line planning and HTTP
orchestration were interleaved (e.g. a 500-line `orders.ts` mixing wire
types, parsing, search, totals, planning and updates; route handlers holding
use-case logic), and the Bigblue adapter depended on domain types while the
domain depended on Shopify types, forming a cycle between layers. The
project is expected to be audited and to scale to more product pairs,
triggers and contributors (human and AI).

## Decision

- Reorganise into explicit layers (`app` → `lib/http` →
  `lib/subscriptions/application` → `lib/subscriptions/domain` →
  `lib/integrations/*` → `lib/shared`/`config`), documented in
  [layers.md](../architecture/layers.md) and **enforced** with ESLint
  `no-restricted-imports`.
- Move Bigblue line planning into the domain (it is a business rule), which
  removes the layer cycle.
- Keep route handlers as thin HTTP adapters over use cases; preserve route
  segment config as literal exports.
- Pin the observable behaviour of every endpoint (status, body,
  `Cache-Control`, ordered log events and levels) with route
  characterization tests written *before* the refactor.
- Adopt the MISSENCE Documentation Standard: every module and declaration is
  documented with JSDoc, validated and rendered into a generated API
  reference by an in-repo engine; `pnpm check` fails on violations or a stale
  reference.

## Consequences

- Architectural drift and undocumented code fail CI instead of code review.
- Moving code between layers sometimes requires inverting a dependency
  (passing a factory or data) rather than importing directly.
- Contributors must run `pnpm docs:generate` when a documented API changes.
