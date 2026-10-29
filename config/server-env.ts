/**
 * @file Typed, validated access to server-side secrets and environment.
 *
 * This is the only module that reads `process.env` at runtime. Values are read
 * lazily on every call (never cached at import time) so that a missing secret
 * surfaces as a handled error inside the request that needs it, instead of
 * crashing the whole deployment at boot.
 *
 * The `server-only` import makes any accidental client-side import a build
 * error, guaranteeing secrets never reach the browser bundle.
 *
 * @module config/server-env
 */

import "server-only";

import { SHOPIFY_CONFIG } from "@/config/shopify";

/** Permanent Shopify admin hostname, e.g. `cy6gdd-q8.myshopify.com`. */
const MYSHOPIFY_HOSTNAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/**
 * Raised when a required variable is missing, empty or malformed.
 *
 * The message lists variable *names* only, never values.
 */
export class EnvironmentConfigurationError extends Error {
  /**
   * @param variableNames - Accepted names for the missing setting, in priority order.
   */
  constructor(readonly variableNames: readonly string[]) {
    super(`Missing required environment variable: ${variableNames.join(" or ")}`);
    this.name = "EnvironmentConfigurationError";
  }
}

/**
 * Returns the first non-blank value among several accepted variable names.
 *
 * Supporting several names lets us rename variables without breaking existing
 * deployments (e.g. `SHOPIFY_WEBHOOK_SECRET` and legacy `SHOPIFY_WEBHOOK_KEY`).
 *
 * @param names - Variable names to try, in priority order.
 * @returns The trimmed value.
 * @throws {EnvironmentConfigurationError} When none of the names has a value.
 */
function requireEnvironmentVariable(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new EnvironmentConfigurationError(names);
}

/**
 * Shopify app client secret used to verify `X-Shopify-Hmac-SHA256`.
 *
 * @returns The webhook signing secret.
 * @throws {EnvironmentConfigurationError} When neither `SHOPIFY_WEBHOOK_SECRET`
 *   nor the legacy `SHOPIFY_WEBHOOK_KEY` is set.
 */
export function getShopifyWebhookSecret(): string {
  return requireEnvironmentVariable(
    "SHOPIFY_WEBHOOK_SECRET",
    "SHOPIFY_WEBHOOK_KEY",
  );
}

/**
 * Private Storefront API token, used only by the server-side health check.
 *
 * @returns The private Storefront token.
 * @throws {EnvironmentConfigurationError} When `SHOPIFY_PRIVATE_ACCESS_TOKEN` is unset.
 */
export function getShopifyPrivateAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_PRIVATE_ACCESS_TOKEN");
}

/**
 * Public Storefront API token. Reserved for future client-side use; the
 * current integration does not need it.
 *
 * @returns The public Storefront token.
 * @throws {EnvironmentConfigurationError} When `SHOPIFY_PUBLIC_ACCESS_TOKEN` is unset.
 */
export function getShopifyPublicAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_PUBLIC_ACCESS_TOKEN");
}

/**
 * Storefront hostname used by the health check.
 *
 * Falls back to {@link SHOPIFY_CONFIG.defaultStoreDomain}. Accepts either a
 * bare hostname or an `https://` origin.
 *
 * @returns The validated hostname, without scheme or path.
 * @throws {EnvironmentConfigurationError} When the value is not a bare HTTPS origin.
 * @throws {TypeError} When the value cannot be parsed as a URL at all.
 */
export function getShopifyStoreDomain(): string {
  const value =
    process.env.SHOPIFY_STORE_DOMAIN?.trim() ||
    SHOPIFY_CONFIG.defaultStoreDomain;
  const url = new URL(value.includes("://") ? value : `https://${value}`);

  if (url.protocol !== "https:" || url.pathname !== "/") {
    throw new EnvironmentConfigurationError(["SHOPIFY_STORE_DOMAIN"]);
  }

  return url.hostname;
}

/**
 * Bearer token for outbound Bigblue Store API requests.
 *
 * @returns The Bigblue API key.
 * @throws {EnvironmentConfigurationError} When `BIGBLUE_API_KEY` is unset.
 */
export function getBigblueApiKey(): string {
  return requireEnvironmentVariable("BIGBLUE_API_KEY");
}

/**
 * Bigblue app *Shared secret*: verifies webhook HMACs and derives the optional
 * private webhook URL token.
 *
 * @returns The Bigblue webhook key.
 * @throws {EnvironmentConfigurationError} When `BIGBLUE_WEBHOOK_KEY` is unset.
 */
export function getBigblueWebhookKey(): string {
  return requireEnvironmentVariable("BIGBLUE_WEBHOOK_KEY");
}

/**
 * Admin GraphQL token with the `read_orders` scope (not the Storefront token).
 *
 * @returns The Admin API access token.
 * @throws {EnvironmentConfigurationError} When neither `SHOPIFY_ACCESS_TOKEN`
 *   nor `SHOPIFY_ADMIN_ACCESS_TOKEN` is set.
 */
export function getShopifyAdminAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_ACCESS_TOKEN", "SHOPIFY_ADMIN_ACCESS_TOKEN");
}

/**
 * Permanent `*.myshopify.com` hostname for Admin API calls and webhook
 * shop-domain checks.
 *
 * Prefers `SHOPIFY_ADMIN_STORE_DOMAIN`, falling back to `SHOPIFY_STORE_DOMAIN`
 * when that already is the permanent hostname. The value is validated strictly
 * because it is interpolated into the request URL that carries the Admin
 * token: anything other than a bare `https://<shop>.myshopify.com` origin is
 * rejected.
 *
 * @returns The validated `*.myshopify.com` hostname.
 * @throws {EnvironmentConfigurationError} When unset or not a bare myshopify origin.
 */
export function getShopifyAdminStoreDomain(): string {
  const configured = requireEnvironmentVariable("SHOPIFY_ADMIN_STORE_DOMAIN", "SHOPIFY_STORE_DOMAIN");
  let url: URL;
  try {
    url = new URL(configured.includes("://") ? configured : `https://${configured}`);
  } catch {
    throw new EnvironmentConfigurationError(["SHOPIFY_ADMIN_STORE_DOMAIN", "SHOPIFY_STORE_DOMAIN"]);
  }
  if (
    url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash ||
    url.username || url.password || url.port ||
    !MYSHOPIFY_HOSTNAME_PATTERN.test(url.hostname)
  ) {
    throw new EnvironmentConfigurationError(["SHOPIFY_ADMIN_STORE_DOMAIN", "SHOPIFY_STORE_DOMAIN"]);
  }
  return url.hostname;
}

/**
 * Bearer secret the external scheduler must send to the reconciliation cron.
 *
 * @returns The cron secret.
 * @throws {EnvironmentConfigurationError} When `RECONCILIATION_CRON_SECRET` is unset.
 */
export function getReconciliationCronSecret(): string {
  return requireEnvironmentVariable("RECONCILIATION_CRON_SECRET");
}
