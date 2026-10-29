/**
 * @file Conversion of Shopify line amounts into Bigblue unit pricing.
 *
 * Shopify reports a unit price (possibly tax-inclusive), per-line tax lines
 * and a per-line total discount. Bigblue expects a *net* `unit_price`, a
 * `unit_tax` and a line `discount`. All arithmetic happens in integer cents.
 *
 * @module lib/subscriptions/domain/line-pricing
 */

import type { ShopifyOrderLineItem } from "@/lib/integrations/shopify/order";
import { formatMoney } from "@/lib/shared/money";

/** Bigblue pricing for one logistics line, as decimal strings. */
export type LinePricing = {
  /** Net price per unit (tax excluded). */
  unitPrice: string;
  /** Tax per unit. */
  unitTax: string;
  /** Discount for the whole line, including any rounding remainder. */
  discount: string;
};

/** Aggregated line amounts in integer cents. */
export type LineTotals = {
  /** Net price for all units (tax excluded). */
  price: number;
  /** Tax for all units. */
  tax: number;
  /** Discount for all units. */
  discount: number;
};

/** Pricing used for lines that ship zero units. */
const ZERO_PRICING: LinePricing = { unitPrice: "0.00", unitTax: "0.00", discount: "0.00" };

/**
 * Sums Shopify line items into net price, tax and discount cents.
 *
 * When Shopify prices include tax, the tax is subtracted from the gross price
 * so it is not counted twice once Bigblue adds `unit_tax` back.
 *
 * @param items - Shopify line items of one product.
 * @param taxesIncluded - Shopify `taxes_included` for the order.
 * @returns The aggregated totals in cents.
 */
export function sumLineTotals(items: readonly ShopifyOrderLineItem[], taxesIncluded: boolean): LineTotals {
  return items.reduce((total, item) => {
    const tax = item.tax_lines.reduce(
      (sum, line) => sum + Math.round(Number(line.price) * 100), 0,
    );
    const price = Math.round(Number(item.price) * 100) * item.quantity;
    return {
      price: total.price + price - (taxesIncluded ? tax : 0),
      tax: total.tax + tax,
      discount: total.discount + Math.round(Number(item.total_discount) * 100),
    };
  }, { price: 0, tax: 0, discount: 0 });
}

/**
 * Splits line totals into per-unit Bigblue pricing that reproduces the totals
 * exactly.
 *
 * Unit price and unit tax are rounded *up* to whole cents; the over-allocation
 * this creates is added to the line discount. Consequently
 * `quantity × (unitPrice + unitTax) − discount` equals
 * `totals.price + totals.tax − totals.discount` to the cent.
 *
 * @param totals - Line totals in cents.
 * @param quantity - Units the line will ship.
 * @returns Per-unit pricing, or all zeros when `quantity` is `0`.
 *
 * @invariant `quantity × (unitPrice + unitTax) − discount === price + tax − discount` (in cents).
 */
export function toUnitPricing(totals: LineTotals, quantity: number): LinePricing {
  if (quantity === 0) return { ...ZERO_PRICING };
  const unitPrice = Math.ceil(totals.price / quantity);
  const unitTax = Math.ceil(totals.tax / quantity);
  return {
    unitPrice: formatMoney(unitPrice / 100),
    unitTax: formatMoney(unitTax / 100),
    discount: formatMoney(
      (totals.discount +
        unitPrice * quantity - totals.price +
        unitTax * quantity - totals.tax) /
        100,
    ),
  };
}
