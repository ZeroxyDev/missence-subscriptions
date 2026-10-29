/**
 * @file Renders the generated API reference (`docs/reference/api.md`).
 *
 * The output is deterministic (stable ordering, no timestamps) so that the
 * freshness check can compare it byte-for-byte with the committed file.
 *
 * @module scripts/docs/render-reference
 */

import type { DocBlock, DocModule, DocSymbol } from "./source-model";

/**
 * Reference sections in dependency order, from the outermost layer inwards.
 * Each docModule is placed in the first section whose prefix matches its path.
 */
const SECTIONS = [
  { prefix: "app/", title: "App — Route Handlers and pages" },
  { prefix: "components/", title: "Components" },
  { prefix: "lib/http/", title: "HTTP adapters" },
  { prefix: "lib/subscriptions/application/", title: "Subscriptions — application (use cases)" },
  { prefix: "lib/subscriptions/domain/", title: "Subscriptions — domain (pure rules)" },
  { prefix: "lib/integrations/shopify/", title: "Integration — Shopify" },
  { prefix: "lib/integrations/bigblue/", title: "Integration — Bigblue" },
  { prefix: "lib/health/", title: "Health" },
  { prefix: "lib/observability/", title: "Observability" },
  { prefix: "lib/shared/", title: "Shared utilities" },
  { prefix: "config/", title: "Configuration" },
  { prefix: "scripts/", title: "Tooling scripts" },
  { prefix: "", title: "Root configuration" },
] as const;

/** Longest signature rendered verbatim before truncation. */
const MAX_SIGNATURE_LINES = 60;

/**
 * Escapes text for use inside a Markdown table cell.
 *
 * @param text - Raw text.
 * @returns Single-line text with pipes escaped.
 */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

/**
 * Truncates very long declarations (e.g. data tables) for readability.
 *
 * @param signature - Declaration text.
 * @returns At most {@link MAX_SIGNATURE_LINES} lines.
 */
function clampSignature(signature: string): string {
  const lines = signature.split("\n");
  return lines.length <= MAX_SIGNATURE_LINES
    ? signature
    : [...lines.slice(0, MAX_SIGNATURE_LINES), "// … (truncated, see source)"].join("\n");
}

/**
 * Builds a GitHub-style anchor for a module heading.
 *
 * @param moduleId - Module id.
 * @returns Anchor slug.
 */
function anchor(moduleId: string): string {
  return moduleId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Renders the tags of a block as Markdown sections.
 *
 * @param doc - Documentation block.
 * @returns Markdown lines.
 */
function renderTags(doc: DocBlock): string[] {
  const lines: string[] = [];
  const params = doc.tags.filter((tag) => tag.name === "param");
  if (params.length > 0) {
    lines.push("", "| Parameter | Description |", "| --- | --- |");
    for (const tag of params) lines.push(`| \`${cell(tag.paramName ?? "")}\` | ${cell(tag.text)} |`);
  }
  const labelled: [string, string][] = [
    ["returns", "Returns"],
    ["throws", "Throws"],
    ["invariant", "Invariant"],
    ["sideEffects", "Side effects"],
    ["remarks", "Remarks"],
    ["see", "See"],
    ["deprecated", "Deprecated"],
  ];
  for (const [name, label] of labelled) {
    for (const tag of doc.tags.filter((candidate) => candidate.name === name)) {
      const type = tag.type ? `\`${tag.type}\` ` : "";
      lines.push("", `**${label}:** ${type}${tag.text}`);
    }
  }
  for (const tag of doc.tags.filter((candidate) => candidate.name === "example")) {
    lines.push("", "**Example:**", "", tag.text);
  }
  return lines;
}

/**
 * Renders one exported symbol.
 *
 * @param symbol - Symbol model.
 * @returns Markdown lines.
 */
function renderSymbol(symbol: DocSymbol): string[] {
  const lines = [
    `#### \`${symbol.name}\``,
    "",
    `<sub>${symbol.kind}</sub>`,
    "",
    "```ts",
    clampSignature(symbol.signature),
    "```",
  ];
  if (symbol.doc) {
    lines.push("", symbol.doc.summary, ...renderTags(symbol.doc));
  }
  if (symbol.constructorInfo?.doc && symbol.constructorInfo.params.length > 0) {
    lines.push("", "**Constructor:**", ...renderTags(symbol.constructorInfo.doc));
  }
  lines.push("");
  return lines;
}

/**
 * Renders one docModule: header summary followed by its exported symbols.
 *
 * @param docModule - Module model.
 * @returns Markdown lines.
 */
function renderModule(docModule: DocModule): string[] {
  const fileTag = docModule.header?.tags.find((tag) => tag.name === "file");
  const exported = docModule.symbols.filter((symbol) => symbol.exported);
  const lines = [
    `### \`${docModule.expectedModuleId}\``,
    "",
    `Source: [\`${docModule.filePath}\`](../../${docModule.filePath})`,
    "",
    `**${fileTag?.text.split("\n")[0] ?? ""}**`,
  ];
  const description = [fileTag?.text.split("\n").slice(1).join("\n").trim(), docModule.header?.summary]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
  if (description) lines.push("", description);
  const see = docModule.header?.tags.filter((tag) => tag.name === "see") ?? [];
  for (const tag of see) lines.push("", `**See:** ${tag.text}`);
  lines.push("");
  if (exported.length === 0) {
    lines.push("_No exports (entry point or side-effect module)._", "");
  }
  for (const symbol of exported) lines.push(...renderSymbol(symbol));
  return lines;
}

/**
 * Renders the complete API reference document.
 *
 * @param modules - Every docModule model.
 * @returns The Markdown document.
 */
export function renderReference(modules: readonly DocModule[]): string {
  const grouped = SECTIONS.map((section) => ({
    ...section,
    modules: modules.filter((docModule) =>
      SECTIONS.find((candidate) => docModule.filePath.startsWith(candidate.prefix)) === section),
  })).filter((section) => section.modules.length > 0);

  const exportedCount = modules.reduce((total, docModule) => total + docModule.symbols.filter((symbol) => symbol.exported).length, 0);
  const lines = [
    "<!-- GENERATED FILE — do not edit. Run `pnpm docs:generate`. Source of truth: JSDoc in the code. -->",
    "",
    "# API reference",
    "",
    `Generated from source by the MISSENCE documentation engine (\`scripts/docs\`). ${modules.length} modules, ${exportedCount} exported symbols.`,
    "",
    "See [the documentation standard](../standards/documentation.md) for how this file is produced and validated.",
    "",
    "## Contents",
    "",
  ];
  for (const section of grouped) {
    lines.push(`- **${section.title}**`);
    for (const docModule of section.modules) {
      lines.push(`  - [\`${docModule.expectedModuleId}\`](#${anchor(docModule.expectedModuleId)})`);
    }
  }
  for (const section of grouped) {
    lines.push("", `## ${section.title}`, "");
    for (const docModule of section.modules) lines.push(...renderModule(docModule));
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
