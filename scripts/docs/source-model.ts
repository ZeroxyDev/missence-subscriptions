/**
 * @file Source discovery and documentation model extraction.
 *
 * Parses every documented source file with the TypeScript compiler (syntax
 * only, no type-checking, so it is fast and works on `.mjs` too) and builds a
 * {@link DocModule} per file: its header block and its top-level symbols with
 * their JSDoc. Both the validator and the reference renderer consume this
 * model, so they can never disagree about what the code says.
 *
 * @module scripts/docs/source-model
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

/** Directories scanned recursively for documented sources. */
const SOURCE_DIRECTORIES = ["app", "components", "config", "lib", "scripts"] as const;
/** Root-level files that are part of the documented surface. */
const ROOT_SOURCE_FILES = ["eslint.config.mjs", "next.config.ts", "postcss.config.mjs"] as const;
/** Extensions of documented sources. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs"]);
/** Module-constant naming convention (`UPPER_SNAKE_CASE`). */
const CONSTANT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
/** Leading `- ` that separates a `@param` name from its description. */
const DESCRIPTION_DASH_PATTERN = /^-\s*/;

/** One JSDoc block tag, e.g. `@param value - The value`. */
export type DocTag = {
  /** Tag name without `@`, e.g. `param`. */
  name: string;
  /** Free text after the tag (and after the parameter name / type, when present). */
  text: string;
  /** Parameter name for `@param` tags. */
  paramName?: string;
  /** `{Type}` expression for `@throws` and typed JS tags. */
  type?: string;
};

/** A parsed JSDoc block. */
export type DocBlock = {
  /** Description before the first tag. */
  summary: string;
  tags: DocTag[];
};

/** Kind of a top-level declaration. */
export type SymbolKind = "function" | "class" | "type" | "interface" | "enum" | "const";

/** A function-like parameter as seen by the validator. */
export type DocParameter = {
  /** Identifier name, or `null` for a destructured binding pattern. */
  name: string | null;
};

/** A top-level declaration and its documentation. */
export type DocSymbol = {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  /** 1-based line of the declaration. */
  line: number;
  /** Declaration text without its body, for the reference. */
  signature: string;
  /** JSDoc attached to the declaration (the file header is never counted). */
  doc: DocBlock | null;
  /** Parameters, for functions and arrow-function constants. */
  params: DocParameter[] | null;
  /** Constructor parameters and JSDoc, for classes. */
  constructorInfo: { params: DocParameter[]; doc: DocBlock | null; line: number } | null;
  /** Whether the documentation standard requires this symbol to be documented. */
  requiresDoc: boolean;
};

/** A source file and its documentation model. */
export type DocModule = {
  /** Repository-relative POSIX path, e.g. `lib/shared/money.ts`. */
  filePath: string;
  /** Expected `@module` id: the path without extension. */
  expectedModuleId: string;
  /** The first `/** … *\/` block of the file, when it carries `@file`. */
  header: DocBlock | null;
  symbols: DocSymbol[];
};

/**
 * Recursively lists documented source files under a directory.
 *
 * @param root - Repository root.
 * @param directory - Directory relative to `root`.
 * @returns Repository-relative POSIX paths.
 */
function walk(root: string, directory: string): string[] {
  const entries = readdirSync(path.join(root, directory), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return walk(root, relative);
    const isDeclarationFile = entry.name.endsWith(".d.ts");
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !isDeclarationFile ? [relative] : [];
  });
}

/**
 * Lists every file covered by the documentation standard, sorted.
 *
 * @param root - Repository root.
 * @returns Repository-relative POSIX paths.
 */
export function discoverSourceFiles(root: string): string[] {
  const files = [
    ...SOURCE_DIRECTORIES.flatMap((directory) => walk(root, directory)),
    ...ROOT_SOURCE_FILES,
  ];
  return [...new Set(files)].sort();
}

/**
 * Normalises JSDoc prose: trims and collapses indentation of continuation lines.
 *
 * @param text - Raw comment text.
 * @returns Clean text, preserving blank-line paragraph breaks and code fences.
 */
function cleanText(text: string | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim();
}

/**
 * Parses a raw `/** … *\/` comment into a {@link DocBlock}.
 *
 * Used for file headers, which the compiler does not attach to a declaration.
 *
 * @param raw - Comment text including delimiters.
 * @returns The parsed block.
 */
function parseRawDocComment(raw: string): DocBlock {
  const lines = raw
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""));
  const summary: string[] = [];
  const tags: DocTag[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const tagMatch = !inFence ? /^@(\w+)\s*(.*)$/.exec(line.trim()) : null;
    if (tagMatch) {
      tags.push({ name: tagMatch[1], text: tagMatch[2] });
    } else if (tags.length > 0) {
      tags[tags.length - 1].text += `\n${line}`;
    } else {
      summary.push(line);
    }
  }
  return {
    summary: cleanText(summary.join("\n")),
    tags: tags.map((tag) => ({ ...tag, text: cleanText(tag.text) })),
  };
}

/**
 * Converts a compiler JSDoc node into a {@link DocBlock}.
 *
 * @param jsDoc - Compiler JSDoc node.
 * @returns The parsed block.
 */
function toDocBlock(jsDoc: ts.JSDoc): DocBlock {
  return {
    summary: cleanText(ts.getTextOfJSDocComment(jsDoc.comment)),
    tags: (jsDoc.tags ?? []).map((tag): DocTag => {
      const text = cleanText(ts.getTextOfJSDocComment(tag.comment)).replace(DESCRIPTION_DASH_PATTERN, "");
      if (ts.isJSDocParameterTag(tag)) {
        return {
          name: tag.tagName.text,
          text,
          paramName: tag.name.getText(),
          ...(tag.typeExpression ? { type: tag.typeExpression.type.getText() } : {}),
        };
      }
      const typeExpression = (tag as ts.JSDocTag & { typeExpression?: ts.JSDocTypeExpression }).typeExpression;
      return {
        name: tag.tagName.text,
        text,
        ...(typeExpression && ts.isJSDocTypeExpression(typeExpression) ? { type: typeExpression.type.getText() } : {}),
      };
    }),
  };
}

/**
 * Returns the JSDoc attached to a declaration, ignoring the file header.
 *
 * The compiler attaches a file's leading header to its first statement, so
 * any block containing `@file` is skipped; the closest remaining block wins.
 *
 * @param node - Declaration node.
 * @returns The declaration's own JSDoc, or `null`.
 */
function getOwnDoc(node: ts.Node): DocBlock | null {
  const blocks = ts.getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .filter((jsDoc) => !(jsDoc.tags ?? []).some((tag) => tag.tagName.text === "file"));
  const last = blocks.at(-1);
  return last ? toDocBlock(last) : null;
}

/**
 * Maps compiler parameters to {@link DocParameter}s.
 *
 * @param parameters - Compiler parameter nodes.
 * @returns Parameter names (`null` for destructuring patterns).
 */
function toParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): DocParameter[] {
  return parameters.map((parameter) => ({
    name: ts.isIdentifier(parameter.name) ? parameter.name.text : null,
  }));
}

/**
 * Checks for the `export` modifier.
 *
 * @param node - Statement node.
 * @returns `true` when exported.
 */
function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Computes the 1-based line of a node.
 *
 * @param sourceFile - Containing file.
 * @param node - Node.
 * @returns Line number.
 */
function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Extracts the top-level symbols of a source file.
 *
 * Documentation is required for: every export, every function, class, type,
 * interface and enum, and every module constant (`UPPER_SNAKE_CASE`) or
 * function-valued constant. Script-local working variables are exempt.
 *
 * @param sourceFile - Parsed file.
 * @returns Symbols in declaration order.
 */
function extractSymbols(sourceFile: ts.SourceFile): DocSymbol[] {
  const text = sourceFile.text;
  const symbols: DocSymbol[] = [];

  for (const statement of sourceFile.statements) {
    const exported = isExported(statement);
    const line = lineOf(sourceFile, statement);
    const doc = getOwnDoc(statement);

    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text ?? "default";
      const end = statement.body ? statement.body.getStart(sourceFile) : statement.end;
      symbols.push({
        name, kind: "function", exported, line, doc,
        signature: text.slice(statement.getStart(sourceFile), end).trim(),
        params: toParameters(statement.parameters),
        constructorInfo: null,
        requiresDoc: true,
      });
    } else if (ts.isClassDeclaration(statement)) {
      const constructor = statement.members.find(ts.isConstructorDeclaration);
      const membersStart = statement.members.pos;
      symbols.push({
        name: statement.name?.text ?? "default", kind: "class", exported, line, doc,
        signature: text.slice(statement.getStart(sourceFile), membersStart).replace(/\{\s*$/, "").trim(),
        params: null,
        constructorInfo: constructor
          ? { params: toParameters(constructor.parameters), doc: getOwnDoc(constructor), line: lineOf(sourceFile, constructor) }
          : null,
        requiresDoc: true,
      });
    } else if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement)) {
      symbols.push({
        name: statement.name.text,
        kind: ts.isTypeAliasDeclaration(statement) ? "type" : ts.isInterfaceDeclaration(statement) ? "interface" : "enum",
        exported, line, doc,
        signature: statement.getText(sourceFile),
        params: null,
        constructorInfo: null,
        requiresDoc: true,
      });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        const initializer = declaration.initializer;
        const callable = initializer !== undefined &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
        symbols.push({
          name, kind: "const", exported, line, doc,
          signature: statement.getText(sourceFile),
          params: callable ? toParameters(initializer.parameters) : null,
          constructorInfo: null,
          requiresDoc: exported || callable || CONSTANT_NAME_PATTERN.test(name) || /Config$/.test(name),
        });
      }
    } else if (ts.isExportAssignment(statement)) {
      // `export default x`: documented through `x` itself.
      continue;
    }
  }

  return symbols;
}

/**
 * Builds the documentation model of one file.
 *
 * @param root - Repository root.
 * @param filePath - Repository-relative POSIX path.
 * @returns The module model.
 */
export function loadModule(root: string, filePath: string): DocModule {
  const text = readFileSync(path.join(root, filePath), "utf8");
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : filePath.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
  const firstBlock = /\/\*\*[\s\S]*?\*\//.exec(text);
  const header = firstBlock ? parseRawDocComment(firstBlock[0]) : null;

  return {
    filePath,
    expectedModuleId: filePath.replace(/\.(ts|tsx|mjs)$/, ""),
    header: header && header.tags.some((tag) => tag.name === "file") ? header : null,
    symbols: extractSymbols(sourceFile),
  };
}

/**
 * Loads the documentation model of the whole repository.
 *
 * @param root - Repository root.
 * @returns One model per documented source file.
 */
export function loadProject(root: string): DocModule[] {
  return discoverSourceFiles(root).map((filePath) => loadModule(root, filePath));
}
