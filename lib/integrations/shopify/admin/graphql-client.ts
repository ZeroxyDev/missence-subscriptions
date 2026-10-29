/**
 * @file Single entry point for Shopify Admin GraphQL requests.
 *
 * @module lib/integrations/shopify/admin/graphql-client
 */

import { getShopifyAdminGraphqlUrl } from "@/config/shopify";
import { ShopifyAdminOrdersError } from "@/lib/integrations/shopify/admin/errors";
import { readObject } from "@/lib/integrations/shopify/admin/response-readers";

/** Parameters of {@link postAdminGraphql}. */
export type AdminGraphqlRequest = {
  /** Permanent `*.myshopify.com` hostname. */
  storeDomain: string;
  /** Admin API token with `read_orders`. */
  accessToken: string;
  /** GraphQL document. */
  query: string;
  /** GraphQL variables. */
  variables: Record<string, unknown>;
  /** Abort the request after this many milliseconds. */
  timeoutMs: number;
  /** Injectable `fetch`, for tests. */
  fetchImplementation: typeof fetch;
};

/**
 * POSTs a GraphQL document to the Admin API and returns the response root.
 *
 * Any HTTP error, non-JSON body or top-level GraphQL `errors` entry is turned
 * into a {@link ShopifyAdminOrdersError}. Partial data is never returned.
 *
 * @param request - Endpoint, credentials, document and timeout.
 * @returns The response root object (containing `data`).
 * @throws {ShopifyAdminOrdersError} On any failure.
 */
export async function postAdminGraphql({
  storeDomain,
  accessToken,
  query,
  variables,
  timeoutMs,
  fetchImplementation,
}: AdminGraphqlRequest): Promise<Record<string, unknown>> {
  const response = await fetchImplementation(getShopifyAdminGraphqlUrl(storeDomain), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new ShopifyAdminOrdersError(`Shopify Admin HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShopifyAdminOrdersError("Shopify Admin returned invalid JSON");
  }
  const root = readObject(body, "response");
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new ShopifyAdminOrdersError("Shopify Admin GraphQL query failed");
  }
  return root;
}
