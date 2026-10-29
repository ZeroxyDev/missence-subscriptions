/**
 * @file Reproduction of Bigblue's order `total` calculation, in cents.
 *
 * The integration refuses to write unless the Bigblue total it is about to
 * produce equals Shopify's total *to the cent*. That requires computing the
 * total exactly the way Bigblue does, before and after every update.
 *
 * @module lib/integrations/bigblue/order-totals
 */

import type { BigblueLineItem, BigblueOrder } from "@/lib/integrations/bigblue/types";
import { toCents } from "@/lib/shared/money";

/**
 * Computes a Bigblue order total in cents.
 *
 * Formula (confirmed against live orders #1050–#1053, including a line
 * discount that Bigblue applies once per line, not per unit):
 *
 * ```text
 * total = shipping_price + shipping_tax + additional_tax − additional_discount
 *       + Σ line (quantity × (unit_price + unit_tax) − discount)
 * ```
 *
 * @param order - Order whose header-level amounts are used.
 * @param lineItems - Lines to total; defaults to the order's own lines, but a
 *   *planned* set can be passed to preview the post-update total.
 * @param additionalTaxOverride - Replaces `order.additional_tax`, e.g. `"0.00"`
 *   to preview clearing a rounding residue.
 * @returns The total in cents, or `null` when any amount is missing/invalid.
 *   `null` means "unverifiable" and must block the write.
 */
export function calculateBigblueTotalCents(
  order: BigblueOrder,
  lineItems: readonly BigblueLineItem[] = order.line_items,
  additionalTaxOverride?: string,
): number | null {
  const shippingPrice = toCents(order.shipping_price ?? "0");
  const shippingTax = toCents(order.shipping_tax ?? "0");
  const additionalTax = toCents(additionalTaxOverride ?? order.additional_tax ?? "0");
  const additionalDiscount = toCents(order.additional_discount ?? "0");
  if (
    shippingPrice === null || shippingTax === null ||
    additionalTax === null || additionalDiscount === null
  ) {
    return null;
  }

  let total = shippingPrice + shippingTax + additionalTax - additionalDiscount;
  for (const item of lineItems) {
    const unitPrice = toCents(item.unit_price);
    const unitTax = toCents(item.unit_tax ?? "0");
    const discount = toCents(item.discount ?? "0");
    if (unitPrice === null || unitTax === null || discount === null) return null;
    total += item.quantity * (unitPrice + unitTax) - discount;
  }
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Decides whether a ±1 cent `additional_tax` rounding residue should be
 * cleared as part of the update.
 *
 * Bigblue sometimes imports Shopify orders with `additional_tax: "±0.01"` to
 * absorb its own rounding. Clearing it is allowed *only* when doing so makes
 * the planned total match Shopify exactly. No compensating cent is ever
 * invented to hide a mismatch.
 *
 * @param order - Current Bigblue order.
 * @param plannedLineItems - Lines that will be written.
 * @param shopifyTotalPrice - Shopify `total_price`.
 * @returns `true` when clearing the residue yields an exact match.
 */
export function shouldClearRoundingAdditionalTax(
  order: BigblueOrder,
  plannedLineItems: readonly BigblueLineItem[],
  shopifyTotalPrice: string | undefined,
): boolean {
  const additionalTax = toCents(order.additional_tax);
  const shopifyTotal = toCents(shopifyTotalPrice);

  if (
    additionalTax === null || Math.abs(additionalTax) !== 1 ||
    shopifyTotal === null
  ) {
    return false;
  }
  return calculateBigblueTotalCents(order, plannedLineItems, "0.00") === shopifyTotal;
}
