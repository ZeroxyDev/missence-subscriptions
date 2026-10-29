---
name: document-code
description: Document TypeScript modules to the MISSENCE Documentation Standard (MDS) — file headers, JSDoc tags, invariants and side effects — and regenerate the API reference.
---

# Document code (MDS)

1. Header at the top of every file (after `"use client"` if present):
   ```ts
   /**
    * @file One-line summary.
    *
    * Why the module exists, what it owns, what it deliberately does not do.
    *
    * @module <path/without/extension>
    */
   ```
2. Every function, class, type, interface, enum, module constant (`UPPER_SNAKE_CASE`) and export gets a JSDoc summary. Functions: `@param name - …` for each parameter, `@returns` (use "Nothing." for void), `@throws {Class} When …` for errors callers handle, `@sideEffects` for writes/logs/global state, `@invariant` for properties the code relies on.
3. Allowed tags only: file, module, param, returns, throws, example, see, remarks, invariant, sideEffects, typeParam, deprecated.
4. Inline comments explain *why* (external constraints, invariants), never restate the code.
5. `pnpm docs:generate && pnpm docs:check`.
