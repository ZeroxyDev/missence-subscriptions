import "server-only";

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

export function getBigblueApiKey(): string {
  return requireEnvironmentVariable("BIGBLUE_API_KEY");
}

