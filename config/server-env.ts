import "server-only";

import { SHOPIFY_CONFIG } from "@/config/shopify";

export class EnvironmentConfigurationError extends Error {
  constructor(readonly variableNames: readonly string[]) {
    super(`Missing required environment variable: ${variableNames.join(" or ")}`);
    this.name = "EnvironmentConfigurationError";
  }
}

function requireEnvironmentVariable(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new EnvironmentConfigurationError(names);
}

export function getShopifyWebhookSecret(): string {
  return requireEnvironmentVariable(
    "SHOPIFY_WEBHOOK_SECRET",
    "SHOPIFY_WEBHOOK_KEY",
  );
}

export function getShopifyPrivateAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_PRIVATE_ACCESS_TOKEN");
}

export function getShopifyPublicAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_PUBLIC_ACCESS_TOKEN");
}

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

export function getBigblueApiKey(): string {
  return requireEnvironmentVariable("BIGBLUE_API_KEY");
}

export function getBigblueWebhookKey(): string {
  return requireEnvironmentVariable("BIGBLUE_WEBHOOK_KEY");
}

export function getShopifyAdminAccessToken(): string {
  return requireEnvironmentVariable("SHOPIFY_ACCESS_TOKEN", "SHOPIFY_ADMIN_ACCESS_TOKEN");
}

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
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(url.hostname)
  ) {
    throw new EnvironmentConfigurationError(["SHOPIFY_ADMIN_STORE_DOMAIN", "SHOPIFY_STORE_DOMAIN"]);
  }
  return url.hostname;
}

export function getReconciliationCronSecret(): string {
  return requireEnvironmentVariable("RECONCILIATION_CRON_SECRET");
}
