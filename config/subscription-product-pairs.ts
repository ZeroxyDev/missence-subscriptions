/**
 * @file Catalogue of subscription/experience product pairs.
 *
 * A *pair* links a recurring subscription product with the one-off
 * "experience" product that Shopify adds only to the initial checkout (or to a
 * resubscription). Seeing both products in the same order is what identifies a
 * first shipment.
 *
 * Every identifier is explicit. Replacements are never inferred from naming
 * patterns such as the `-UP` suffix: SKU, product ID and variant ID may differ
 * for each pair.
 *
 * @module config/subscription-product-pairs
 */

/** Identity of a Shopify product variant as it appears in order line items. */
type ConfiguredProduct = {
  /** SKU expected on the Shopify line item and used as Bigblue `product`. */
  sku: string;
  /** Shopify numeric product ID (`legacyResourceId`). */
  productId: number;
  /**
   * Shopify numeric variant ID. `null` disables only the variant check; the
   * SKU and product ID must still match.
   */
  variantId: number | null;
};

/** A subscription product and the experience product that marks its first shipment. */
export type SubscriptionProductPair = {
  /** Stable identifier used in logs and adjustment results. */
  id: string;
  /** Recurring product whose units are partly shipped inside the experience. */
  subscription: ConfiguredProduct;
  /** First-shipment product, plus the SKU Bigblue must ship instead of it. */
  experience: ConfiguredProduct & {
    /** Physical SKU that replaces the experience in the Bigblue logistics copy. */
    replacement: ConfiguredProduct;
  };
};

/**
 * Production pair catalogue.
 *
 * Detection iterates in this order and stops at the first match, so the order
 * of entries is significant if a single checkout could ever match two pairs.
 */
export const PRODUCT_PAIRS = [
  {
    id: "MISS_0002_0004",
    subscription: {
      sku: "MISS-000000-0002",
      productId: 10791019643207,
      variantId: 53887845564743,
    },
    experience: {
      sku: "MISS-000000-0004-UP",
      productId: 10987479859527,
      variantId: 54579708854599,
      replacement: {
        sku: "MISS-000000-0004",
        productId: 10897754554695,
        variantId: 54311286243655,
      },
    },
  },
  {
    id: "MISS_0001_0003",
    subscription: {
      sku: "MISS-000000-0001",
      productId: 10790886310215,
      variantId: 54328475517255,
    },
    experience: {
      sku: "MISS-000000-0003-UP",
      productId: 10987460002119,
      variantId: 54579583025479,
      replacement: {
        sku: "MISS-000000-0003",
        productId: 10897753637191,
        variantId: 54311284736327,
      },
    },
  },
] as const satisfies readonly SubscriptionProductPair[];

/** Union of the configured pair identifiers, e.g. `"MISS_0002_0004"`. */
export type ProductPairId = (typeof PRODUCT_PAIRS)[number]["id"];
