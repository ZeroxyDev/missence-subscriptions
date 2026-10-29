/**
 * @file Static Shopify API configuration (no secrets).
 *
 * @module config/shopify
 */

/** Versioned Shopify API settings shared by every Shopify call. */
export const SHOPIFY_CONFIG = {
  /** Public storefront domain used when `SHOPIFY_STORE_DOMAIN` is not set. */
  defaultStoreDomain: "missence.com",
  /** Storefront API version used by the live health check. */
  storefrontApiVersion: "2026-07",
  /** Admin GraphQL API version used to read current order state. */
  adminApiVersion: "2026-07",
} as const;

/**
 * Builds the Storefront GraphQL endpoint for a store.
 *
 * @param storeDomain - Bare hostname, e.g. `missence.com`.
 * @returns The absolute HTTPS GraphQL endpoint.
 */
export function getShopifyStorefrontGraphqlUrl(storeDomain: string): string {
  return `https://${storeDomain}/api/${SHOPIFY_CONFIG.storefrontApiVersion}/graphql.json`;
}

/**
 * Builds the Admin GraphQL endpoint for a store.
 *
 * @param storeDomain - Permanent `*.myshopify.com` hostname.
 * @returns The absolute HTTPS Admin GraphQL endpoint.
 */
export function getShopifyAdminGraphqlUrl(storeDomain: string): string {
  return `https://${storeDomain}/admin/api/${SHOPIFY_CONFIG.adminApiVersion}/graphql.json`;
}
