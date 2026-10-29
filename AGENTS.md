<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules (MISSENCE Subscriptions)

Shopify → Bigblue first-shipment integration. Start with `docs/README.md`.

## Non-negotiables
- Never write to Shopify. Only the Bigblue logistics copy is adjusted, only while `PENDING` (docs/adr/0001).
- Target state is derived from Shopify only; every operation must stay idempotent (docs/adr/0002).
- Money is compared in integer cents and must match Shopify exactly before and after writes; never invent compensating amounts (docs/adr/0003).
- Do not rename error classes, log events or their levels, HTTP status mappings, or `TOKEN_CONTEXT` without an explicit decision — they are operational contracts pinned by tests.

## Architecture
- Layers and allowed imports: docs/architecture/layers.md (enforced by ESLint). Use the `@/` alias; no `../` imports.
- Route handlers in `app/api` stay thin; logic lives in `lib/subscriptions/application` (use cases) and `lib/subscriptions/domain` (pure rules). Keep `runtime`/`maxDuration`/`dynamic` as literal exports in route files.
- Components: `components/ui` = domain-free primitives; feature folders for everything else.
- `tests/` mirrors the source tree; route tests use `tests/support/route-harness.ts`.

## Workflow
- Document every module/declaration to the standard in docs/standards/documentation.md; run `pnpm docs:generate` when exports change.
- Before declaring work done: `pnpm check` and `pnpm build` (skill: `quality-gate`).
- Subagents and skills for this repo: docs/ai-tooling.md.
- Code, comments and docs in English; user-facing UI strings stay in Spanish.
