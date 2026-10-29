/**
 * @file ESLint configuration, including machine-enforced architecture layers.
 *
 * Dependency direction (an arrow means "may import"):
 *
 *   app ─► lib/http ─► lib/subscriptions/application ─► lib/subscriptions/domain
 *                                   │                          │
 *                                   ▼                          ▼
 *                          lib/integrations/* ──────────► lib/shared
 *                                   │
 *                                   ▼
 *                    config, lib/observability
 *
 * See docs/architecture/layers.md for the rationale of every rule below.
 *
 * @module eslint.config
 */

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Builds a `no-restricted-imports` rule from forbidden alias patterns.
 *
 * Every layer also forbids parent-relative imports so that dependencies are
 * always spelled with the `@/` alias and therefore visible to these rules.
 *
 * @param {string} layer - Human-readable layer name for the error message.
 * @param {string[]} forbidden - gitignore-style patterns of forbidden modules.
 * @param {string} [forbiddenRegex] - Regex of forbidden modules, for "everything
 *   except …" rules (gitignore-style negations do not re-include sub-paths).
 * @returns {import("eslint").Linter.RulesRecord} The rule configuration.
 */
function layerRule(layer, forbidden, forbiddenRegex) {
  const message = `Architecture violation: the ${layer} layer may not import this module (see docs/architecture/layers.md).`;
  return {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["../*"], message: "Use the `@/` path alias instead of parent-relative imports." },
        ...(forbidden.length === 0 ? [] : [{ group: forbidden, message }]),
        ...(forbiddenRegex === undefined ? [] : [{ regex: forbiddenRegex, message }]),
      ],
    }],
  };
}

/** UI modules: no library layer may depend on them. */
const UI = ["@/app/**", "@/components/**"];

/** Next.js recommended rules plus the architecture layer rules. */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["lib/shared/**/*.ts"],
    rules: layerRule("shared", ["@/config/**", ...UI], "^@/lib/(?!shared/).*$"),
  },
  {
    files: ["lib/observability/**/*.ts"],
    rules: layerRule("observability", ["@/config/**", ...UI], "^@/lib/(?!shared/|observability/).*$"),
  },
  {
    files: ["config/**/*.ts"],
    rules: layerRule("config", ["@/lib/**", ...UI]),
  },
  {
    files: ["lib/integrations/bigblue/**/*.ts"],
    rules: layerRule("Bigblue integration", [
      "@/lib/subscriptions/**", "@/lib/http/**", "@/lib/health/**", "@/lib/integrations/shopify/**", ...UI,
    ]),
  },
  {
    files: ["lib/integrations/shopify/**/*.ts"],
    rules: layerRule("Shopify integration", [
      "@/lib/subscriptions/**", "@/lib/http/**", "@/lib/health/**", "@/lib/integrations/bigblue/**", ...UI,
    ]),
  },
  {
    files: ["lib/subscriptions/domain/**/*.ts"],
    rules: layerRule("domain", [
      "@/config/server-env", "@/lib/subscriptions/application/**", "@/lib/http/**", "@/lib/health/**",
      "@/lib/observability/**", "@/lib/integrations/*/client", "@/lib/integrations/shopify/admin/**", ...UI,
    ]),
  },
  {
    files: ["lib/subscriptions/application/**/*.ts"],
    rules: layerRule("application", ["@/lib/http/**", "@/lib/health/**", ...UI]),
  },
  {
    files: ["lib/health/**/*.ts"],
    rules: layerRule("health", ["@/lib/subscriptions/**", "@/lib/http/**", ...UI]),
  },
  {
    files: ["lib/http/**/*.ts"],
    rules: layerRule("HTTP adapter", UI),
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["../*"], message: "Use the `@/` path alias instead of parent-relative imports." },
          {
            // Client bundles may only see public config and the health contract.
            regex: "^@/(config/server-env|app/.*|lib/(?!health/types$).*)$",
            message: "Architecture violation: client components may only import public config and `@/lib/health/types` (see docs/architecture/layers.md).",
          },
        ],
      }],
    },
  },
  {
    // Generic UI primitives must stay domain-free so they can be reused anywhere.
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: layerRule("UI primitive", [], "^@/(config|lib|app)/.*$|^@/components/(?!ui/).*$"),
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: layerRule("app", []),
  },
]);

export default eslintConfig;
