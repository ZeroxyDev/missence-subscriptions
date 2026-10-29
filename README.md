# MISSENCE Subscriptions

Next.js service that keeps Bigblue's logistics copy of MISSENCE
first-shipment subscription orders correct — without ever modifying Shopify.

When a checkout contains a subscription **and** its first-shipment
"experience" product (which physically includes one subscription unit),
the warehouse must ship one fewer loose subscription unit per experience and
ship the experience as its configured physical SKU, while the order total in
Bigblue stays exactly equal to Shopify's.

```text
Shopify orders/create ──► verify HMAC ──► detect pair ──► locate Bigblue order
        │                                                     │
        │                         plan lines, prove total == Shopify (to the cent)
        │                                                     │
        └── orders/updated · orders/edited · Bigblue status · cron (every ~5 min)
                         └──► idempotent reconciliation while Bigblue is PENDING
```

## Quick start

```bash
pnpm install
cp .env.example .env      # fill in the secrets (see the runbook)
pnpm dev
pnpm missence             # interactive menu: dev, check, docs, dry-run, build
```

## Quality gate

```bash
pnpm check   # Next typegen, TypeScript, ESLint (incl. architecture layers), tests, documentation standard
pnpm build   # production build
```

## Documentation

| Topic | Link |
| --- | --- |
| Start here | [docs/README.md](docs/README.md) |
| Architecture & flows | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Layers (machine-enforced) | [docs/architecture/layers.md](docs/architecture/layers.md) |
| Decisions | [docs/adr/](docs/adr/README.md) |
| Setup, env vars, logs, incident playbooks | [docs/operations/runbook.md](docs/operations/runbook.md) |
| API reference (generated) | [docs/reference/api.md](docs/reference/api.md) |
| Engineering & documentation standards | [docs/standards/](docs/standards/engineering.md) |
| AI agents & skills | [docs/ai-tooling.md](docs/ai-tooling.md) |

## Stack

Next.js 16 (App Router, Route Handlers) · React 19 · strict TypeScript ·
Tailwind CSS v4 · `node:test` via `tsx` · zero runtime dependencies beyond
Next/React.

## Repository layout

```text
app/                 Pages and Route Handlers (thin HTTP adapters)
components/          ui/ primitives · brand/ · layout/ · home/ · operations/
config/              Product pairs, feature flags, API settings, env access
lib/
  http/              Response envelopes, secret loading, bearer auth
  subscriptions/     application/ (use cases) · domain/ (pure rules)
  integrations/      shopify/ · bigblue/ (one adapter per vendor)
  health/            /api/health probes
  observability/     Structured log catalogue
  shared/            Guards, money, crypto, async, errors
scripts/             Project CLI, Bigblue dry-run, webhook URL helper, docs engine
tests/               Mirrors the source tree; support/ holds harness and fakes
docs/                Architecture, ADRs, runbook, standards, generated reference
.claude/             Project subagents and skills
```
