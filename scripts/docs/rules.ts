/**
 * @file Validation rules of the MISSENCE Documentation Standard (MDS).
 *
 * Each rule has a stable code so violations are easy to search for and to
 * reference from `docs/standards/documentation.md`.
 *
 * @module scripts/docs/rules
 */

import type { DocBlock, DocModule, DocParameter } from "./source-model";

/** Every JSDoc tag allowed by the standard. Anything else is a typo or drift. */
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

/** A single standard violation. */
export type DocViolation = {
  /** Stable rule code, e.g. `MDS003`. */
  code: string;
  /** Repository-relative file path. */
  filePath: string;
  /** 1-based line, when the violation is tied to a declaration. */
  line: number | null;
  message: string;
};

/**
 * Checks `@param`/`@returns`/tag rules for a function-like declaration.
 *
 * @param doc - Its JSDoc.
 * @param params - Its parameters.
 * @param requireReturns - Whether `@returns` is mandatory (false for constructors).
 * @param report - Violation sink.
 * @returns Nothing.
 */
function checkCallableDoc(
  doc: DocBlock,
  params: readonly DocParameter[],
  requireReturns: boolean,
  report: (code: string, message: string) => void,
): void {
  const documented = doc.tags.filter((tag) => tag.name === "param").map((tag) => tag.paramName ?? "");
  const hasDestructuring = params.some((param) => param.name === null);

  for (const param of params) {
    if (param.name !== null && !documented.includes(param.name)) {
      report("MDS004", `parameter \`${param.name}\` has no @param`);
    }
  }
  if (documented.length < params.length) {
    report("MDS004", `${params.length} parameter(s) but only ${documented.length} @param tag(s)`);
  }
  if (!hasDestructuring) {
    for (const name of documented) {
      if (!params.some((param) => param.name === name)) {
        report("MDS005", `@param \`${name}\` does not match any parameter`);
      }
    }
  }
  if (requireReturns && !doc.tags.some((tag) => tag.name === "returns")) {
    report("MDS006", "missing @returns");
  }
}

/**
 * Validates one docModule against the standard.
 *
 * Rules:
 * - `MDS001` file header with `@file` and a summary is required.
 * - `MDS002` `@module` must equal the file path without extension.
 * - `MDS003` every symbol that requires documentation has a JSDoc summary.
 * - `MDS004` every parameter is documented with `@param`.
 * - `MDS005` no `@param` for a non-existent parameter.
 * - `MDS006` every function documents `@returns`.
 * - `MDS007` only tags from {@link ALLOWED_TAGS} are used.
 * - `MDS008` constructors with parameters document them.
 *
 * @param docModule - Module model.
 * @returns Violations, empty when compliant.
 */
export function validateModule(docModule: DocModule): DocViolation[] {
  const violations: DocViolation[] = [];
  const report = (line: number | null) => (code: string, message: string) => {
    violations.push({ code, filePath: docModule.filePath, line, message });
  };
  const checkTags = (doc: DocBlock, line: number | null) => {
    for (const tag of doc.tags) {
      if (!ALLOWED_TAGS.has(tag.name)) report(line)("MDS007", `unknown tag @${tag.name}`);
    }
  };

  if (!docModule.header || !docModule.header.tags.find((tag) => tag.name === "file")?.text) {
    report(null)("MDS001", "missing file header (`/** @file <summary> … */`)");
  } else {
    checkTags(docModule.header, null);
    const moduleTag = docModule.header.tags.find((tag) => tag.name === "module")?.text;
    if (moduleTag !== docModule.expectedModuleId) {
      report(null)("MDS002", `@module must be \`${docModule.expectedModuleId}\` (found \`${moduleTag ?? "none"}\`)`);
    }
  }

  for (const symbol of docModule.symbols) {
    const at = report(symbol.line);
    if (!symbol.requiresDoc) continue;
    if (!symbol.doc || symbol.doc.summary.length === 0) {
      at("MDS003", `\`${symbol.name}\` (${symbol.kind}) has no JSDoc summary`);
      continue;
    }
    checkTags(symbol.doc, symbol.line);
    if (symbol.params) {
      checkCallableDoc(symbol.doc, symbol.params, true, at);
    }
    const constructorInfo = symbol.constructorInfo;
    if (constructorInfo && constructorInfo.params.length > 0) {
      const atConstructor = report(constructorInfo.line);
      if (!constructorInfo.doc) {
        atConstructor("MDS008", `constructor of \`${symbol.name}\` has parameters but no JSDoc`);
      } else {
        checkTags(constructorInfo.doc, constructorInfo.line);
        checkCallableDoc(constructorInfo.doc, constructorInfo.params, false, atConstructor);
      }
    }
  }

  return violations;
}
