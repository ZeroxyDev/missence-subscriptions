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
