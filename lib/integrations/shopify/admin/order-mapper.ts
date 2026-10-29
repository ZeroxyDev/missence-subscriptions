/**
 * @file Maps an Admin GraphQL order node onto the canonical `ShopifyOrder`.
 *
 * The mapped order goes through `parseShopifyOrder`, the same validator used
 * for webhooks, so both entry points produce identical domain input and the
 * same first-shipment adjustment.
 *
 * @module lib/integrations/shopify/admin/order-mapper
 */

import { ShopifyAdminOrdersError } from "@/lib/integrations/shopify/admin/errors";
import { LINE_ITEMS_PAGE_SIZE } from "@/lib/integrations/shopify/admin/queries";
import {
  readArray,
  readLegacyId,
  readMoneyBagAmount,
  readObject,
  readOptionalLegacyId,
} from "@/lib/integrations/shopify/admin/response-readers";
import { parseShopifyOrder, type ShopifyOrder } from "@/lib/integrations/shopify/order";

/** Matches a line item global ID and captures its numeric part. */
const LINE_ITEM_GID_PATTERN = /^gid:\/\/shopify\/LineItem\/(\d+)$/;

/** A Shopify order plus the status needed to decide whether it may be reconciled. */
export type ReconciliationCandidate = {
  /** Current order state (after edits). */
  order: ShopifyOrder;
  /** `true` when `cancelledAt` is set. */
  cancelled: boolean;
  /** `true` when the order has been edited since checkout. */
  edited: boolean;
  /** `displayFulfillmentStatus`; only `"UNFULFILLED"` orders are reconciled. */
  fulfillmentStatus: string;
};

/**
 * Prorates a whole-line amount from the original to the current quantity.
 *
 * Admin reports discounts and taxes for the *original* quantity; after an
 * edit removes units, only the current share belongs to the order.
 *
 * @param amount - Original line amount (decimal string).
 * @param currentQuantity - Units remaining after edits.
 * @param originalQuantity - Units at checkout.
 * @returns The prorated amount as a two-decimal string (`"0.00"` if the original quantity is `0`).
 */
function prorateLineAmount(amount: string, currentQuantity: number, originalQuantity: number): string {
  if (originalQuantity === 0) return "0.00";
  const cents = Math.round(Number(amount) * 100);
  return (Math.round(cents * currentQuantity / originalQuantity) / 100).toFixed(2);
}

/**
 * Validates and maps one Admin GraphQL order node.
 *
 * Rejects orders whose shop/presentment currencies disagree with their totals
 * and orders with more line items than were fetched.
 *
 * @param value - Raw `Order` node.
 * @returns The reconciliation candidate.
 * @throws {ShopifyAdminOrdersError} On any shape or consistency violation.
 * @throws {InvalidShopifyOrderError} When the mapped order fails canonical validation.
 */
export function parseReconciliationCandidate(value: unknown): ReconciliationCandidate {
  const node = readObject(value, "order");
  const totalPriceSet = readObject(node.currentTotalPriceSet, "order.currentTotalPriceSet");
  if (
    readObject(totalPriceSet.shopMoney, "order.currentTotalPriceSet.shopMoney").currencyCode !== node.currencyCode ||
    readObject(totalPriceSet.presentmentMoney, "order.currentTotalPriceSet.presentmentMoney").currencyCode !== node.presentmentCurrencyCode
  ) {
    throw new ShopifyAdminOrdersError("Order total currencies are inconsistent");
  }
  const lineItems = readObject(node.lineItems, "order.lineItems");
  const lineItemsPageInfo = readObject(lineItems.pageInfo, "order.lineItems.pageInfo");
  if (lineItemsPageInfo.hasNextPage !== false) {
    throw new ShopifyAdminOrdersError(`Order has more than ${LINE_ITEMS_PAGE_SIZE} line items`);
  }

  // Map into the REST webhook shape and reuse its validator.
  const order = parseShopifyOrder(JSON.stringify({
    id: readLegacyId(node.legacyResourceId, "order.legacyResourceId"),
    name: node.name,
    currency: node.currencyCode,
    presentment_currency: node.presentmentCurrencyCode,
    presentment_total_price: readMoneyBagAmount(totalPriceSet, "order.currentTotalPriceSet", "presentmentMoney"),
    created_at: node.createdAt,
    taxes_included: node.taxesIncluded,
    total_price: readMoneyBagAmount(totalPriceSet, "order.currentTotalPriceSet"),
    line_items: readArray(lineItems.nodes, "order.lineItems.nodes").map((rawItem, index) => {
      const path = `order.lineItems[${index}]`;
      const item = readObject(rawItem, path);
      if (
        !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.currentQuantity) ||
        Number(item.quantity) < 0 || Number(item.currentQuantity) < 0 ||
        Number(item.currentQuantity) > Number(item.quantity)
      ) {
        throw new ShopifyAdminOrdersError(`${path}.quantity is invalid`);
      }
      const originalQuantity = Number(item.quantity);
      const currentQuantity = Number(item.currentQuantity);
      const match = typeof item.id === "string" ? LINE_ITEM_GID_PATTERN.exec(item.id) : null;
      if (!match) {
        throw new ShopifyAdminOrdersError(`${path}.id is invalid`);
      }
      return {
        id: readLegacyId(match[1], `${path}.id`),
        product_id: readOptionalLegacyId(item.product, `${path}.product`),
        variant_id: readOptionalLegacyId(item.variant, `${path}.variant`),
        sku: item.sku,
        // Current units, so items removed by an edit are not shipped.
        quantity: currentQuantity,
        price: readMoneyBagAmount(item.originalUnitPriceSet, `${path}.originalUnitPriceSet`),
        total_discount: prorateLineAmount(
          readMoneyBagAmount(item.totalDiscountSet, `${path}.totalDiscountSet`),
          currentQuantity,
          originalQuantity,
        ),
        tax_lines: readArray(item.taxLines, `${path}.taxLines`).map((taxLine, taxIndex) => ({
          price: prorateLineAmount(
            readMoneyBagAmount(
              readObject(taxLine, `${path}.taxLines[${taxIndex}]`).priceSet,
              `${path}.taxLines[${taxIndex}].priceSet`,
            ),
            currentQuantity,
            originalQuantity,
          ),
        })),
      };
    }),
  }));

  if (node.cancelledAt !== null && typeof node.cancelledAt !== "string") {
    throw new ShopifyAdminOrdersError("order.cancelledAt is invalid");
  }
  if (typeof node.edited !== "boolean" || typeof node.displayFulfillmentStatus !== "string") {
    throw new ShopifyAdminOrdersError("order status is invalid");
  }
  return {
    order,
    cancelled: node.cancelledAt !== null,
    edited: node.edited,
    fulfillmentStatus: node.displayFulfillmentStatus,
  };
}
