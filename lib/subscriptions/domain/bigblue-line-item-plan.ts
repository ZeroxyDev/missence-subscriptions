/**
 * @file Pure planning of the Bigblue line items for a first shipment.
 *
 * Given Bigblue's current lines and the target from
 * `detectFirstShipmentAdjustment`, computes the exact line set to write and
 * whether Bigblue already holds it. Planning is a pure function of
 * (current lines, Shopify-derived target): applying the plan and planning
 * again yields `alreadyAdjusted: true`, which is the idempotency guarantee
 * every caller relies on.
 *
 * @module lib/subscriptions/domain/bigblue-line-item-plan
 */

import type { FulfillmentSettings } from "@/config/fulfillment-settings";
import { InvalidBigblueResponseError } from "@/lib/integrations/bigblue/errors";
import type { BigblueLineItem } from "@/lib/integrations/bigblue/types";
import type { ActionableAdjustment } from "@/lib/subscriptions/domain/first-shipment-adjustment";
import type { LinePricing } from "@/lib/subscriptions/domain/line-pricing";

/** Outcome of {@link planBigblueLineItemAdjustment}. */
export type BigblueLineItemAdjustmentPlan = {
  /** `true` when Bigblue already matches the target quantities, SKUs and pricing. */
  alreadyAdjusted: boolean;
  /** Loose subscription units Bigblue held before the plan. */
  previousQuantity: number;
  /** Complete line set to write (or already present). */
  lineItems: BigblueLineItem[];
};

/**
 * Maps domain pricing onto Bigblue line-item fields.
 *
 * @param pricing - Domain pricing.
 * @returns `unit_price`, `unit_tax` and `discount` fields.
 */
function financialFields(pricing: LinePricing) {
  return { unit_price: pricing.unitPrice, unit_tax: pricing.unitTax, discount: pricing.discount };
}

/**
 * Compares a Bigblue line's amounts with target pricing numerically, so that
 * `"0"` and `"0.00"` are considered equal.
 *
 * @param item - Bigblue line item.
 * @param pricing - Target pricing.
 * @returns `true` when unit price, unit tax and discount all match.
 */
function matchesPricing(item: BigblueLineItem, pricing: LinePricing) {
  return Number(item.unit_price) === Number(pricing.unitPrice) &&
    Number(item.unit_tax ?? 0) === Number(pricing.unitTax) &&
    Number(item.discount ?? 0) === Number(pricing.discount);
}

/**
 * Plans the experience line: collapse every experience/replacement line into
 * a single line with the target SKU, quantity and pricing, keeping the
 * position of the first one.
 *
 * Pricing is always taken from Shopify, even if Bigblue already holds the
 * replacement SKU with a different price (e.g. a €1 placeholder). Retries
 * compare amounts instead of adding them, so value is never transferred twice.
 *
 * @param lineItems - Current Bigblue lines.
 * @param adjustment - Shopify-derived target.
 * @param enabled - `FulfillmentSettings.replaceExperienceSku`.
 * @returns Whether the experience line is already correct, and the new lines.
 */
function planExperienceSkuReplacement(
  lineItems: readonly BigblueLineItem[],
  adjustment: ActionableAdjustment,
  enabled: boolean,
): { alreadyReplaced: boolean; lineItems: BigblueLineItem[] } {
  const experienceProduct = enabled
    ? adjustment.experienceReplacementSku
    : adjustment.experienceSku;

  const sourceItems = lineItems.filter(
    (lineItem) => lineItem.product === adjustment.experienceSku,
  );
  const replacementItems = lineItems.filter(
    (lineItem) => lineItem.product === adjustment.experienceReplacementSku,
  );

  if (
    sourceItems.length === 0 &&
    replacementItems.length === 1 &&
    replacementItems[0].quantity === adjustment.experienceQuantity &&
    replacementItems[0].product === experienceProduct &&
    matchesPricing(replacementItems[0], adjustment.experiencePricing)
  ) {
    return { alreadyReplaced: true, lineItems: [...lineItems] };
  }

  // Reuse an existing line as template to keep any Bigblue-specific fields.
  const template = sourceItems[0] ?? replacementItems[0];
  const replacement: BigblueLineItem = {
    ...template,
    product: experienceProduct,
    quantity: adjustment.experienceQuantity,
    ...financialFields(adjustment.experiencePricing),
  };
  const result: BigblueLineItem[] = [];
  let replacementInserted = false;

  for (const lineItem of lineItems) {
    const isExperience =
      lineItem.product === adjustment.experienceSku ||
      lineItem.product === adjustment.experienceReplacementSku;

    if (!isExperience) {
      result.push(lineItem);
      continue;
    }

    if (!replacementInserted) {
      result.push(replacement);
      replacementInserted = true;
    }
  }

  if (!replacementInserted) {
    result.push(replacement);
  }

  return { alreadyReplaced: false, lineItems: result };
}

/**
 * Plans the complete Bigblue line set for a first-shipment adjustment.
 *
 * Rules:
 * - The experience line is normalised by `planExperienceSkuReplacement`.
 * - The subscription line is set to `targetQuantity` with Shopify pricing.
 * - A target of `0` removes the subscription line; `quantity: 0` is never sent.
 *
 * @param lineItems - Current Bigblue lines.
 * @param adjustment - Shopify-derived target.
 * @param settings - Fulfillment feature flags.
 * @returns The plan; `alreadyAdjusted` is `true` when no write is required
 *   for line items.
 * @throws {InvalidBigblueResponseError} When a non-zero target must be applied
 *   but Bigblue does not hold exactly one subscription line (ambiguous state).
 */
export function planBigblueLineItemAdjustment(
  lineItems: readonly BigblueLineItem[],
  adjustment: ActionableAdjustment,
  settings: FulfillmentSettings,
): BigblueLineItemAdjustmentPlan {
  const experiencePlan = planExperienceSkuReplacement(
    lineItems,
    adjustment,
    settings.replaceExperienceSku,
  );
  const matchingItems = experiencePlan.lineItems.filter(
    (lineItem) => lineItem.product === adjustment.subscriptionSku,
  );
  const previousQuantity = matchingItems.reduce(
    (total, lineItem) => total + lineItem.quantity,
    0,
  );

  if (
    previousQuantity === adjustment.targetQuantity &&
    experiencePlan.alreadyReplaced &&
    matchingItems.every((item) => matchesPricing(item, adjustment.subscriptionPricing))
  ) {
    return {
      alreadyAdjusted: true,
      previousQuantity,
      lineItems: experiencePlan.lineItems,
    };
  }

  if (adjustment.targetQuantity === 0) {
    return {
      alreadyAdjusted: false,
      previousQuantity,
      lineItems: experiencePlan.lineItems.filter(
        (lineItem) => lineItem.product !== adjustment.subscriptionSku,
      ),
    };
  }

  if (matchingItems.length !== 1) {
    throw new InvalidBigblueResponseError(
      `Expected exactly one Bigblue line for ${adjustment.subscriptionSku}`,
    );
  }

  return {
    alreadyAdjusted: false,
    previousQuantity,
    lineItems: experiencePlan.lineItems.map((lineItem) =>
      lineItem.product === adjustment.subscriptionSku
        ? { ...lineItem, quantity: adjustment.targetQuantity, ...financialFields(adjustment.subscriptionPricing) }
        : lineItem,
    ),
  };
}
