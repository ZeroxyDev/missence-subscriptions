---
name: quality-gate
description: Run and interpret the full MISSENCE quality gate (Next typegen, TypeScript, ESLint with architecture rules, tests, documentation standard, production build). Use before declaring any change done.
---

# Quality gate

```bash
pnpm check   # next typegen → tsc → eslint → tests (tests/**/*.test.ts) → docs:check
pnpm build   # production build
```

Interpreting failures:
- `LayoutProps` / route types missing → `next typegen` did not run; use `pnpm check`, not bare `tsc`.
- `Architecture violation: the X layer may not import …` → see docs/architecture/layers.md; move code or invert the dependency. Do not relax the rule silently.
- `MDS00x` → docs/standards/documentation.md lists each rule; fix the JSDoc in source.
- `docs/reference/api.md is stale` → `pnpm docs:generate` and include the file in the change.
- Route test failures show `{ status, body, cacheControl }` or `[level, event]` diffs: these are externally observed contracts. Fix the code, not the assertion, unless the behaviour change is intended and documented.

Report the exact counts (`ℹ tests N`, `pass`, `fail`) and any skipped step.
