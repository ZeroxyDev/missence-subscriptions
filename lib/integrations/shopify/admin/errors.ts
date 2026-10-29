/**
 * @file Error raised by the Shopify Admin GraphQL order reader.
 *
 * @module lib/integrations/shopify/admin/errors
 */

/**
 * The Admin API call failed, or its response violated an expected invariant
 * (shape, currency consistency, pagination). The class name is logged as the
 * failure `reason`; keep it stable.
 */
export class ShopifyAdminOrdersError extends Error {
  /**
   * @param message - Diagnostic description (field paths, HTTP status; never values).
   */
  constructor(message: string) {
    super(message);
    this.name = "ShopifyAdminOrdersError";
  }
}
