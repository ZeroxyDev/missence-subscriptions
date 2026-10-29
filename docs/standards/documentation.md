# MISSENCE Documentation Standard (MDS)

MDS defines how source code is documented and how that documentation is
validated and published. It is enforced by the documentation engine in
[`scripts/docs`](../../scripts/docs) and runs as part of `pnpm check`.

## Scope

Every `.ts`, `.tsx` and `.mjs` file under `app/`, `components/`, `config/`,
`lib/` and `scripts/`, plus `next.config.ts`, `eslint.config.mjs` and
`postcss.config.mjs`. Tests are documented by their test names and are out of
scope.

## Rules

| Code     | Rule                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| `MDS001` | Each file starts with a header block containing `@file <one-line summary>`.                        |
| `MDS002` | The header has `@module <path without extension>`, e.g. `@module lib/shared/money`.                |
| `MDS003` | Every top-level declaration that requires documentation has a JSDoc summary (see below).          |
| `MDS004` | Every parameter of a function, function-valued constant or constructor has a `@param`.            |
| `MDS005` | No `@param` names a parameter that does not exist (destructured parameters are exempt).           |
| `MDS006` | Every function documents `@returns` (write `@returns Nothing.` for `void`).                       |
| `MDS007` | Only the tags listed below are used.                                                              |
| `MDS008` | A class constructor with parameters has its own JSDoc block documenting them.                     |

A declaration **requires documentation** when it is exported, or it is a
function, class, type, interface or enum, or it is a module constant
(`UPPER_SNAKE_CASE`), a configuration object whose name ends in `Config`
(e.g. `nextConfig`, `eslintConfig`) or a function-valued constant. Local working variables
of scripts are exempt.

## Tags

| Tag            | Use                                                                                     |
| -------------- | --------------------------------------------------------------------------------------- |
| `@file`        | Header only. One-line summary of the module; the following paragraphs explain its role. |
| `@module`      | Header only. Path-derived module id.                                                    |
| `@param`       | `@param name - Description.`                                                            |
| `@returns`     | What the caller gets back, including the meaning of `null`/`undefined`.                |
| `@throws`      | `@throws {ErrorClass} When …` — one per error class a caller may need to handle.        |
| `@sideEffects` | Anything observable beyond the return value: writes to Bigblue, logs, global state.     |
| `@invariant`   | A property that always holds and that the code relies on (e.g. exact money identities). |
| `@example`     | A fenced, runnable-looking usage example.                                               |
| `@see`         | Link to external documentation or a related module.                                     |
| `@remarks`     | Extra detail that does not belong in the summary.                                       |
| `@typeParam`   | Generic type parameters.                                                                |
| `@deprecated`  | Planned removal, with the replacement.                                                  |

`@sideEffects` and `@invariant` are MISSENCE extensions to TSDoc. They exist
because the two questions auditors ask first about integration code are
"what does this write?" and "what must always be true?".

## Writing guidance

- **Summary first, one sentence, imperative or descriptive** ("Converts …",
  "Raised when …"). Details go in following paragraphs.
- **Explain why, not what.** The code already says what it does. Comments
  inside function bodies are reserved for non-obvious reasoning, invariants
  and external constraints (API quirks, platform limits).
- **Name the operational contract.** If a value is observed outside the code
  (a log event name, an error class name, an HTTP status, a URL token), say so
  and say who depends on it.
- **Never put secrets, customer data or real order payloads in examples.**

### Header template

```ts
/**
 * @file Exact monetary arithmetic helpers.
 *
 * Why the module exists, what it owns and what it deliberately does not do.
 *
 * @module lib/shared/money
 */
```

### Function template

```ts
/**
 * Converts a monetary amount to integer cents.
 *
 * @param value - Amount as received from an API (string or number).
 * @returns The amount in cents, or `null` when invalid. `null` must block writes.
 */

/**
 * Sends an `UpdateOrder` request.
 *
 * @param request - Bigblue RPC function.
 * @param payload - Full editable order.
 * @returns Resolves when Bigblue accepts the request.
 * @throws {BigblueApiError} When Bigblue rejects the request.
 * @sideEffects Mutates the order in Bigblue.
 */
```

## Tooling

| Command              | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `pnpm docs:check`    | Validates every rule and verifies `docs/reference/api.md` is up to date.       |
| `pnpm docs:generate` | Regenerates `docs/reference/api.md` from the code. Commit the result.         |
| `pnpm check`         | Types, lint (incl. architecture rules), tests and `docs:check`.               |

The engine parses files with the TypeScript compiler API in syntax-only mode
([`source-model.ts`](../../scripts/docs/source-model.ts)), applies the rules
([`rules.ts`](../../scripts/docs/rules.ts)) and renders a deterministic
Markdown reference ([`render-reference.ts`](../../scripts/docs/render-reference.ts)).
Output has no timestamps or line numbers, so it only changes when the
documented API changes.
