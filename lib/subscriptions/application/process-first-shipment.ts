/**
 * @file Use case: bring one Bigblue order to its first-shipment target state.
 *
 * Pipeline (each step either passes or throws, nothing is partially applied):
 *
 * ```text
 * locate Bigblue order ─► guard status/currency/totals ─► plan lines
 *        │                                                    │
 *        ▼                                                    ▼
 *  NotReady (retry)                       already correct? ─► return (no write)
 *                                                             │
 *                                          UpdateOrder ─► re-read ─► verify
 * ```
 *
 * Safety invariants:
 * 1. **Exact money**: nothing is written unless the planned Bigblue total
 *    equals Shopify's `total_price` to the cent, in the same currency.
 * 2. **Verify after write**: success is declared only after re-reading the
 *    order and confirming lines, currency, computed total *and* Bigblue's
 *    reported `total`.
 * 3. **Idempotency**: the target is derived from Shopify only, so repeated
 *    deliveries converge and do not write when Bigblue is already correct.
 *
 * @module lib/subscriptions/application/process-first-shipment
 */

import { FULFILLMENT_SETTINGS } from "@/config/fulfillment-settings";
import {
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
} from "@/lib/integrations/bigblue/errors";
import { findBigblueOrder } from "@/lib/integrations/bigblue/order-search";
import {
  calculateBigblueTotalCents,
  shouldClearRoundingAdditionalTax,
} from "@/lib/integrations/bigblue/order-totals";
import {
  buildUpdateOrderPayload,
  updateBigblueOrder,
} from "@/lib/integrations/bigblue/order-update";
import { readBigblueOrderStatusCode } from "@/lib/integrations/bigblue/parsers";
import type {
  BigblueLineItem,
  BigblueOrder,
  BigblueRequest,
} from "@/lib/integrations/bigblue/types";
import type { ShopifyOrder } from "@/lib/integrations/shopify/order";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { toCents } from "@/lib/shared/money";
import { planBigblueLineItemAdjustment } from "@/lib/subscriptions/domain/bigblue-line-item-plan";
import type { ActionableAdjustment } from "@/lib/subscriptions/domain/first-shipment-adjustment";

/** Successful outcome of {@link processFirstShipmentAdjustment}. */
export type FirstShipmentResult =
  | {
      ok: true;
      /** Bigblue already held the target state; nothing was written. */
      alreadyAdjusted: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      targetQuantity: number;
    }
  | {
      ok: true;
      /** Bigblue was updated and the update was verified. */
      updated: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      previousQuantity: number;
      targetQuantity: number;
    };

/** Options for {@link processFirstShipmentAdjustment}. */
export type ProcessFirstShipmentOptions = {
  /**
   * Only act while Bigblue reports `PENDING`. Used by reconciliation paths,
   * which may run long after checkout when the order could be in preparation.
   */
  requirePending?: boolean;
};

/**
 * Bigblue has moved the order beyond `PENDING`; it can no longer be safely
 * modified and is skipped by reconciliation.
 */
export class BigblueOrderNotPendingError extends Error {
  /**
   * @param orderId - Bigblue order ID.
   * @param status - Current status code, if reported.
   */
  constructor(readonly orderId: string, readonly status: string | undefined) {
    super(`Bigblue order ${orderId} is not pending`);
    this.name = "BigblueOrderNotPendingError";
  }
}

/** Shopify totals validated as comparable with the Bigblue order. */
type ComparableTotals = {
  /** Shopify `total_price` in cents (shop currency). */
  shopifyTotalCents: number;
  /** Bigblue's own reported `total` before any change, in cents. */
  reportedBeforeCents: number;
};

/**
 * Reduces Bigblue lines to the fields relevant for audit logs.
 *
 * @param lineItems - Bigblue line items.
 * @returns Product, quantity and amounts per line.
 */
function summarizeBigblueLineItems(lineItems: readonly BigblueLineItem[]) {
  return lineItems.map(({ product, quantity, unit_price, unit_tax, discount }) => ({ product, quantity, unit_price, unit_tax, discount }));
}

/**
 * Reads `additional_tax` for logging when it is a primitive amount.
 *
 * @param order - Bigblue order.
 * @returns The amount, or `undefined` when absent or non-primitive.
 */
function loggableAdditionalTax(order: BigblueOrder): string | number | undefined {
  return typeof order.additional_tax === "string" || typeof order.additional_tax === "number"
    ? order.additional_tax
    : undefined;
}

/**
 * Lists the `external_id` values Bigblue may use for a Shopify order:
 * the visible name first (current Bigblue behaviour), then the numeric ID.
 *
 * @param order - Shopify order.
 * @param adjustment - Detected adjustment.
 * @returns Candidate external IDs.
 */
function getBigblueExternalIds(order: ShopifyOrder, adjustment: ActionableAdjustment): string[] {
  return order.name
    ? [order.name, adjustment.shopifyOrderId]
    : [adjustment.shopifyOrderId];
}

/**
 * Ensures Shopify and Bigblue amounts can be compared exactly.
 *
 * Refuses to continue when the currencies differ, a total is missing, or the
 * customer paid in a different currency/amount than the shop total (currency
 * conversion would make any Bigblue price claim inexact).
 *
 * @param order - Shopify order.
 * @param adjustment - Detected adjustment.
 * @param bigblueOrder - Current Bigblue order.
 * @returns Validated totals in cents.
 * @throws {InvalidBigblueResponseError} When totals are not exactly comparable.
 * @sideEffects Logs `price_mismatch` (stage `currency` or `customer_price`) before throwing.
 */
function assertComparableTotals(
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
  bigblueOrder: BigblueOrder,
): ComparableTotals {
  if (order.currency && bigblueOrder.currency !== order.currency) {
    logIntegrationEvent("price_mismatch", {
      stage: "currency",
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      shopifyCurrency: order.currency,
      bigblueCurrency: typeof bigblueOrder.currency === "string" ? bigblueOrder.currency : undefined,
    });
    throw new InvalidBigblueResponseError(`Bigblue currency does not match Shopify for ${bigblueOrder.id}`);
  }

  const shopifyTotalCents = toCents(order.total_price);
  const reportedBeforeCents = toCents(bigblueOrder.total);
  if (shopifyTotalCents === null || reportedBeforeCents === null) {
    throw new InvalidBigblueResponseError(`Order total is unavailable for ${bigblueOrder.id}`);
  }

  const customerTotalCents = order.presentment_total_price === undefined
    ? shopifyTotalCents
    : toCents(order.presentment_total_price);
  if (
    customerTotalCents !== shopifyTotalCents ||
    (order.presentment_currency !== undefined && order.presentment_currency !== order.currency)
  ) {
    logIntegrationEvent("price_mismatch", {
      stage: "customer_price",
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      shopifyTotalCents,
      customerTotalCents,
      shopifyCurrency: order.currency,
      customerCurrency: order.presentment_currency,
    });
    throw new InvalidBigblueResponseError(`Customer-facing total cannot be matched to Bigblue for ${bigblueOrder.id}`);
  }

  return { shopifyTotalCents, reportedBeforeCents };
}

/**
 * Re-reads the order after `UpdateOrder` and confirms the write fully persisted.
 *
 * Checks that re-planning yields `alreadyAdjusted`, that any rounding
 * normalisation stuck, that the currency is unchanged, and that both the
 * total recomputed from persisted lines and Bigblue's reported `total` equal
 * Shopify's total.
 *
 * @param request - Bigblue RPC function.
 * @param order - Shopify order.
 * @param adjustment - Detected adjustment.
 * @param context - IDs, Shopify total and whether `additional_tax` was cleared.
 * @returns Resolves when verification passes.
 * @throws {InvalidBigblueResponseError} When the order vanished or did not keep the adjustment.
 * @sideEffects Logs `price_mismatch` (stage `persisted`) and `update_not_persisted`
 *   on failure, or `update_verified` on success.
 */
async function verifyPersistedUpdate(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
  context: {
    bigblueOrderId: string;
    externalIds: readonly string[];
    shopifyTotalCents: number;
    normalizeAdditionalTax: boolean;
  },
): Promise<void> {
  const { bigblueOrderId, externalIds, shopifyTotalCents, normalizeAdditionalTax } = context;
  const persistedOrder = await findBigblueOrder(
    request,
    externalIds,
    order.created_at,
  );

  if (!persistedOrder) {
    throw new InvalidBigblueResponseError(
      `Updated Bigblue order ${bigblueOrderId} could not be verified`,
    );
  }

  const persistedPlan = planBigblueLineItemAdjustment(
    persistedOrder.line_items,
    adjustment,
    FULFILLMENT_SETTINGS,
  );

  const normalizationPersisted = !normalizeAdditionalTax ||
    Number(persistedOrder.additional_tax) === 0;
  const persistedTotalCents = calculateBigblueTotalCents(persistedOrder);
  const reportedPersistedTotalCents = toCents(persistedOrder.total);
  const currencyPersisted = !order.currency || persistedOrder.currency === order.currency;
  const pricePersisted =
    persistedTotalCents === shopifyTotalCents &&
    reportedPersistedTotalCents === shopifyTotalCents &&
    currencyPersisted;

  if (!normalizationPersisted || !persistedPlan.alreadyAdjusted || !pricePersisted) {
    if (!pricePersisted) {
      logIntegrationEvent("price_mismatch", {
        stage: "persisted",
        shopifyOrderId: adjustment.shopifyOrderId,
        bigblueOrderId,
        shopifyTotalCents,
        calculatedBigblueTotalCents: persistedTotalCents,
        reportedBigblueTotalCents: reportedPersistedTotalCents,
        shopifyCurrency: order.currency,
        bigblueCurrency: typeof persistedOrder.currency === "string" ? persistedOrder.currency : undefined,
      });
    }
    logIntegrationEvent("update_not_persisted", {
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId,
      pair: adjustment.pair,
      lineItems: summarizeBigblueLineItems(persistedOrder.line_items),
      additionalTax: loggableAdditionalTax(persistedOrder),
      shopifyTotalCents,
      calculatedBigblueTotalCents: persistedTotalCents,
      reportedBigblueTotalCents: reportedPersistedTotalCents,
      currencyMatches: currencyPersisted,
    });
    throw new InvalidBigblueResponseError(
      `Updated Bigblue order ${bigblueOrderId} did not preserve the adjustment`,
    );
  }

  logIntegrationEvent("update_verified", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId,
    pair: adjustment.pair,
    lineItems: summarizeBigblueLineItems(persistedOrder.line_items),
    additionalTax: loggableAdditionalTax(persistedOrder),
    shopifyTotalCents,
    calculatedBigblueTotalCents: persistedTotalCents,
    reportedBigblueTotalCents: reportedPersistedTotalCents,
  });
}

/**
 * Applies a detected first-shipment adjustment to the Bigblue copy of an
 * order, verifying money and persistence end to end.
 *
 * @param request - Bigblue RPC function (carries the caller's deadline).
 * @param order - Shopify order (source of truth).
 * @param adjustment - Output of `detectFirstShipmentAdjustment` with `shouldAdjust: true`.
 * @param options - See {@link ProcessFirstShipmentOptions}.
 * @returns Whether Bigblue was already correct or has been updated.
 * @throws {BigblueOrderNotReadyError} Bigblue has not imported the order yet (retryable).
 * @throws {BigblueOrderNotPendingError} `requirePending` is set and Bigblue moved on.
 * @throws {InvalidBigblueResponseError} Money/currency mismatch, ambiguous lines,
 *   or the update did not persist (retryable).
 * @throws {BigblueApiError} Transport/HTTP failure talking to Bigblue.
 * @sideEffects May call Bigblue `UpdateOrder`; emits structured log events.
 */
export async function processFirstShipmentAdjustment(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
  options: ProcessFirstShipmentOptions = {},
): Promise<FirstShipmentResult> {
  // 1. Locate the Bigblue copy of the order.
  const externalIds = getBigblueExternalIds(order, adjustment);
  const bigblueOrder = await findBigblueOrder(
    request,
    externalIds,
    order.created_at,
  );
  if (!bigblueOrder) {
    throw new BigblueOrderNotReadyError(externalIds);
  }

  // 2. Guard: only touch orders that are still editable and exactly comparable.
  const status = readBigblueOrderStatusCode(bigblueOrder);
  if (options.requirePending && status !== "PENDING") {
    throw new BigblueOrderNotPendingError(bigblueOrder.id, status);
  }
  const { shopifyTotalCents, reportedBeforeCents } = assertComparableTotals(order, adjustment, bigblueOrder);

  logIntegrationEvent("bigblue_order_found", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    matchedExternalId: String(bigblueOrder.external_id),
    status,
    lineItems: summarizeBigblueLineItems(bigblueOrder.line_items),
  });

  // 3. Plan the target lines and prove the resulting total matches Shopify.
  const plan = planBigblueLineItemAdjustment(
    bigblueOrder.line_items,
    adjustment,
    FULFILLMENT_SETTINGS,
  );
  const normalizeAdditionalTax = shouldClearRoundingAdditionalTax(
    bigblueOrder,
    plan.lineItems,
    order.total_price,
  );
  const plannedTotalCents = calculateBigblueTotalCents(
    bigblueOrder,
    plan.lineItems,
    normalizeAdditionalTax ? "0.00" : undefined,
  );
  if (plannedTotalCents !== shopifyTotalCents) {
    logIntegrationEvent("price_mismatch", {
      stage: "planned",
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      shopifyTotalCents,
      plannedTotalCents,
      reportedBigblueTotalCents: reportedBeforeCents,
    });
    throw new InvalidBigblueResponseError(`Planned Bigblue total does not match Shopify for ${bigblueOrder.id}`);
  }
  // A stale reported total also forces a write, even if lines look correct.
  const needsUpdate = !plan.alreadyAdjusted || normalizeAdditionalTax ||
    reportedBeforeCents !== shopifyTotalCents;

  logIntegrationEvent("adjustment_planned", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    replacementEnabled: FULFILLMENT_SETTINGS.replaceExperienceSku,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
    alreadyAdjusted: !needsUpdate,
    normalizeAdditionalTax,
    shopifyTotalCents,
    plannedTotalCents,
    reportedBigblueTotalCents: reportedBeforeCents,
    before: summarizeBigblueLineItems(bigblueOrder.line_items),
    after: summarizeBigblueLineItems(plan.lineItems),
  });

  // 4a. Idempotent no-op.
  if (!needsUpdate) {
    logIntegrationEvent("price_verified", {
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      totalCents: shopifyTotalCents,
      currency: order.currency,
    });
    logIntegrationEvent("already_adjusted", {
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      pair: adjustment.pair,
      subscriptionSku: adjustment.subscriptionSku,
      targetQuantity: adjustment.targetQuantity,
    });

    return {
      ok: true,
      alreadyAdjusted: true,
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      targetQuantity: adjustment.targetQuantity,
    };
  }

  // 4b. Write, then verify by re-reading.
  const payload = buildUpdateOrderPayload(
    bigblueOrder,
    plan.lineItems,
    normalizeAdditionalTax,
  );
  await updateBigblueOrder(request, payload);
  await verifyPersistedUpdate(request, order, adjustment, {
    bigblueOrderId: bigblueOrder.id,
    externalIds,
    shopifyTotalCents,
    normalizeAdditionalTax,
  });

  logIntegrationEvent("price_verified", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    totalCents: shopifyTotalCents,
    currency: order.currency,
  });

  logIntegrationEvent("updated", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    subscriptionSku: adjustment.subscriptionSku,
    subscriptionQuantity: adjustment.subscriptionQuantity,
    experienceQuantity: adjustment.experienceQuantity,
    experienceSkuReplacement: FULFILLMENT_SETTINGS.replaceExperienceSku,
    experienceReplacementSku: adjustment.experienceReplacementSku,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
  });

  return {
    ok: true,
    updated: true,
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
  };
}
