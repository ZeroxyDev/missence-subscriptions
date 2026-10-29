---
name: add-endpoint
description: Add a new Route Handler (webhook, cron or API endpoint) to the MISSENCE Next.js 16 app following the layered architecture — thin route, application use case, characterization tests, docs.
---

# Add an endpoint

1. Read the relevant guide in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Next 16 differs from older versions).
2. **Use case first** in `lib/subscriptions/application/<verb-noun>.ts`: typed input, discriminated-union outcome (`{ kind: … }`), throws typed errors, emits catalogued log events. Credentials via `config/server-env` getters; inject client factories so env is read lazily.
3. **Route** `app/api/<path>/route.ts`:
   - literal `export const runtime = "nodejs"` (if `node:crypto` is used) and `maxDuration`;
   - authenticate first (HMAC on raw body via `request.text()`, or `isAuthorizedBearer` + `loadRequiredSecret` from `lib/http/request-auth`);
   - call the use case, map outcomes/errors to responses with `lib/http/responses` (`jsonError`, `NO_STORE_HEADERS`…). Transient → 503, permanent → 4xx/502;
   - header block with a status table.
4. **Tests** `tests/app/api/<path>.test.ts` using `useRouteHarness()`; cover auth failures, each outcome and error mapping; assert body, `Cache-Control` and the `[level, event]` sequence.
5. **Docs**: runbook endpoint table + setup steps; `pnpm docs:generate`; ADR if it changes the reconciliation model.
6. Run the `quality-gate` skill.
