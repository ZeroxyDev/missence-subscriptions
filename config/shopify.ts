export const SHOPIFY_CONFIG = {
  defaultStoreDomain: "missence.com",
  storefrontApiVersion: "2026-07",
} as const;

export function getShopifyStorefrontGraphqlUrl(storeDomain: string): string {
  return `https://${storeDomain}/api/${SHOPIFY_CONFIG.storefrontApiVersion}/graphql.json`;
}
