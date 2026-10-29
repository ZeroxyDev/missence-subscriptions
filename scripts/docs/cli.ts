/**
 * @file Command-line entry point of the documentation engine.
 *
 * ```bash
 * pnpm docs:check     # validate the standard + verify the reference is fresh
 * pnpm docs:generate  # regenerate docs/reference/api.md
 * ```
 *
 * `docs:check` is part of `pnpm check`, so undocumented code or a stale
 * reference fails CI exactly like a type error.
 *
 * @module scripts/docs/cli
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { renderReference } from "./render-reference";
import { validateModule, type DocViolation } from "./rules";
import { loadProject } from "./source-model";

/** Repository root (this file lives in `scripts/docs/`). */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
/** Generated reference location. */
const REFERENCE_PATH = path.join(ROOT, "docs", "reference", "api.md");

/**
 * Formats a violation as `path:line  CODE  message`.
 *
 * @param violation - Violation.
 * @returns One output line.
 */
function formatViolation(violation: DocViolation): string {
  const location = violation.line === null ? violation.filePath : `${violation.filePath}:${violation.line}`;
  return `  ${location}  ${violation.code}  ${violation.message}`;
}

/**
 * Validates every module and checks the reference freshness.
 *
 * @returns Process exit code (0 when compliant).
 */
function check(): number {
  const modules = loadProject(ROOT);
  const violations = modules.flatMap(validateModule);
  const symbols = modules.reduce((total, docModule) => total + docModule.symbols.filter((symbol) => symbol.requiresDoc).length, 0);

  if (violations.length > 0) {
    console.error(`✖ Documentation standard: ${violations.length} violation(s)\n`);
    for (const violation of violations) console.error(formatViolation(violation));
    console.error("\nSee docs/standards/documentation.md");
    return 1;
  }

  const expected = renderReference(modules);
  const current = existsSync(REFERENCE_PATH) ? readFileSync(REFERENCE_PATH, "utf8") : "";
  if (current !== expected) {
    console.error("✖ docs/reference/api.md is stale. Run `pnpm docs:generate` and commit the result.");
    return 1;
  }

  console.log(`✔ Documentation standard: ${modules.length} modules, ${symbols} documented declarations, reference up to date.`);
  return 0;
}

/**
 * Regenerates the API reference.
 *
 * @returns Process exit code.
 */
function generate(): number {
  const modules = loadProject(ROOT);
  mkdirSync(path.dirname(REFERENCE_PATH), { recursive: true });
  writeFileSync(REFERENCE_PATH, renderReference(modules));
  console.log(`✔ Wrote ${path.relative(ROOT, REFERENCE_PATH)} (${modules.length} modules).`);
  return 0;
}

/** Supported sub-commands. */
const COMMANDS: Record<string, () => number> = { check, generate };

const command = process.argv[2] ?? "check";
const run = COMMANDS[command];
if (run) {
  process.exitCode = run();
} else {
  console.error(`Unknown command "${command}". Use: ${Object.keys(COMMANDS).join(" | ")}`);
  process.exitCode = 1;
}
