/**
 * @file Global switches for how the Bigblue logistics copy is rewritten.
 *
 * These settings only affect fulfillment in Bigblue. Shopify orders, SKUs,
 * prices, taxes and discounts are never modified.
 *
 * @module config/fulfillment-settings
 */

/** Feature flags that shape the Bigblue line-item adjustment. */
export type FulfillmentSettings = {
  /**
   * When `true`, the experience SKU is always shipped as its explicitly
   * configured `experience.replacement` SKU (see
   * `config/subscription-product-pairs.ts`). When `false`, the original
   * experience SKU is kept.
   */
  replaceExperienceSku: boolean;
};

/** Production fulfillment settings. */
export const FULFILLMENT_SETTINGS: FulfillmentSettings = {
  replaceExperienceSku: true,
};
