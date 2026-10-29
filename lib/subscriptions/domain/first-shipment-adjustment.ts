/**
 * @file Detection of first-shipment orders and their target logistics state.
 *
 * Business rule: the experience product is only added to an initial checkout
 * or a resubscription, and each experience unit physically contains one unit
 * of the subscription product. When both appear in the same order, Bigblue
 * must ship `subscription − experience` loose subscription units, and the
 * experience line carries the value of the units it absorbed so the order
 * total is unchanged.
 *
 * The target is always derived from Shopify, never from Bigblue's current
 * quantities. Re-running detection on the same order therefore converges on
 * the same state, which is what makes every write idempotent.
 *
 * @module lib/subscriptions/domain/first-shipment-adjustment
 */

import { PRODUCT_PAIRS, type ProductPairId } from "@/config/subscription-product-pairs";
import type { ShopifyOrder, ShopifyOrderLineItem } from "@/lib/integrations/shopify/order";
import {
  sumLineTotals,
  toUnitPricing,
  type LinePricing,
  type LineTotals,
} from "@/lib/subscriptions/domain/line-pricing";

/** Result of {@link detectFirstShipmentAdjustment}. */
export type FirstShipmentAdjustment =
  | {
      shouldAdjust: true;
      /** Matched pair identifier. */
      pair: ProductPairId;
      /** Shopify numeric order ID, as a string. */
      shopifyOrderId: string;
      subscriptionSku: string;
      experienceSku: string;
      /** SKU Bigblue ships instead of the experience when replacement is enabled. */
      experienceReplacementSku: string;
      /** Subscription units in the Shopify order. */
      subscriptionQuantity: number;
      /** Experience units in the Shopify order. */
      experienceQuantity: number;
      /** Bigblue pricing for the experience line (its own value + absorbed units). */
      experiencePricing: LinePricing;
      /** Bigblue pricing for the remaining loose subscription units. */
      subscriptionPricing: LinePricing;
      /** Loose subscription units Bigblue must ship: `max(subscription − experience, 0)`. */
      targetQuantity: number;
    }
  | {
      shouldAdjust: false;
    };

/** An adjustment that requires action in Bigblue. */
export type ActionableAdjustment = Extract<FirstShipmentAdjustment, { shouldAdjust: true }>;

/** Product identity used for matching. */
type ProductIdentity = {
  readonly sku: string;
  readonly productId: number;
  readonly variantId: number | null;
};

/**
 * Checks whether a Shopify line item is the configured product.
 *
 * SKU *and* product ID must match; the variant ID is checked only when
 * configured. Lines with zero quantity (e.g. removed by an order edit) never match.
 *
 * @param lineItem - Shopify line item.
 * @param product - Configured product identity.
 * @returns `true` on an exact match.
 */
function matchesProduct(lineItem: ShopifyOrderLineItem, product: ProductIdentity): boolean {
  return (
    lineItem.quantity > 0 &&
    lineItem.sku === product.sku &&
    lineItem.product_id === product.productId &&
    (product.variantId === null || lineItem.variant_id === product.variantId)
  );
}

/**
 * Sums the quantity of several line items.
 *
 * @param items - Line items.
 * @returns Total units.
 */
function sumQuantity(items: readonly ShopifyOrderLineItem[]): number {
  return items.reduce((total, lineItem) => total + lineItem.quantity, 0);
}

/**
 * Scales totals proportionally to a fraction of the original quantity.
 *
 * @param totals - Totals for `fromQuantity` units.
 * @param toQuantity - Units to keep.
 * @param fromQuantity - Original units (must be > 0).
 * @returns Rounded totals for `toQuantity` units.
 */
function prorate(totals: LineTotals, toQuantity: number, fromQuantity: number): LineTotals {
  return {
    price: Math.round(totals.price * toQuantity / fromQuantity),
    tax: Math.round(totals.tax * toQuantity / fromQuantity),
    discount: Math.round(totals.discount * toQuantity / fromQuantity),
  };
}

/**
 * Reduces a line item to the fields useful for diagnosing a detection miss.
 *
 * @param lineItem - Shopify line item.
 * @returns SKU, IDs and quantity only (no prices, no customer data).
 */
function summarizeLineItem(lineItem: ShopifyOrderLineItem) {
  return {
    sku: lineItem.sku,
    productId: lineItem.product_id,
    variantId: lineItem.variant_id,
    quantity: lineItem.quantity,
  };
}

/**
 * Explains, for logging, why an order did or did not match each pair.
 *
 * For every pair it lists the configured identity next to the order lines
 * that share its SKU, which pinpoints product/variant ID mismatches.
 *
 * @param order - Parsed Shopify order.
 * @returns A log-safe diagnostic object.
 */
export function getFirstShipmentDetectionDiagnostics(order: ShopifyOrder) {
  return {
    lineItems: order.line_items.map(summarizeLineItem),
    pairChecks: PRODUCT_PAIRS.map((pair) => ({
      pair: pair.id,
      subscription: {
        expected: pair.subscription,
        sameSku: order.line_items
          .filter((lineItem) => lineItem.sku === pair.subscription.sku)
          .map(summarizeLineItem),
      },
      experience: {
        expected: pair.experience,
        sameSku: order.line_items
          .filter((lineItem) => lineItem.sku === pair.experience.sku)
          .map(summarizeLineItem),
      },
    })),
  };
}

/**
 * Determines whether an order is a first shipment and, if so, the exact
 * logistics state and pricing Bigblue must hold.
 *
 * Value transfer: the experience line receives its own Shopify value plus the
 * value of the subscription units it absorbs; the remaining loose units keep
 * a prorated share. Total value is conserved, so Bigblue's order total stays
 * equal to Shopify's.
 *
 * @param order - Parsed Shopify order (webhook payload or Admin API read).
 * @returns The first matching pair's adjustment, or `{ shouldAdjust: false }`
 *   (e.g. for a renewal, which contains only the subscription).
 */
export function detectFirstShipmentAdjustment(
  order: ShopifyOrder,
): FirstShipmentAdjustment {
  const taxesIncluded = order.taxes_included !== false;

  for (const pair of PRODUCT_PAIRS) {
    const subscriptionItems = order.line_items.filter((lineItem) => matchesProduct(lineItem, pair.subscription));
    const subscriptionQuantity = sumQuantity(subscriptionItems);

    const experienceItems = order.line_items.filter((lineItem) => matchesProduct(lineItem, pair.experience));
    const experienceQuantity = sumQuantity(experienceItems);

    // The experience's presence alongside the subscription is the
    // first-shipment marker; a renewal contains only the subscription.
    if (subscriptionQuantity > 0 && experienceQuantity > 0 && experienceItems[0]) {
      const targetQuantity = Math.max(subscriptionQuantity - experienceQuantity, 0);
      const subscriptionTotals = sumLineTotals(subscriptionItems, taxesIncluded);
      const experienceTotals = sumLineTotals(experienceItems, taxesIncluded);
      const remaining = prorate(subscriptionTotals, targetQuantity, subscriptionQuantity);
      // Everything not kept by the loose units moves into the experience line.
      const combined: LineTotals = {
        price: experienceTotals.price + subscriptionTotals.price - remaining.price,
        tax: experienceTotals.tax + subscriptionTotals.tax - remaining.tax,
        discount: experienceTotals.discount + subscriptionTotals.discount - remaining.discount,
      };
      return {
        shouldAdjust: true,
        pair: pair.id,
        shopifyOrderId: String(order.id),
        subscriptionSku: pair.subscription.sku,
        experienceSku: pair.experience.sku,
        experienceReplacementSku: pair.experience.replacement.sku,
        subscriptionQuantity,
        experienceQuantity,
        experiencePricing: toUnitPricing(combined, experienceQuantity),
        subscriptionPricing: toUnitPricing(remaining, targetQuantity),
        targetQuantity,
      };
    }
  }

  return { shouldAdjust: false };
}
