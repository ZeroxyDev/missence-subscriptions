import { FULFILLMENT_SETTINGS } from "@/config/fulfillment-settings";
import type { BigblueRequest } from "@/lib/bigblue/client";
import {
  buildUpdateOrderPayload,
  calculateBigblueTotalCents,
  findBigblueOrder,
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
  planBigblueLineItemAdjustment,
  shouldClearRoundingAdditionalTax,
  toCents,
  updateBigblueOrder,
} from "@/lib/bigblue/orders";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import type { ShopifyOrder } from "@/lib/shopify/order";
import type { FirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

type ActionableAdjustment = Extract<
  FirstShipmentAdjustment,
  { shouldAdjust: true }
>;

function summarizeBigblueLineItems(
  lineItems: readonly import("@/lib/bigblue/orders").BigblueLineItem[],
) {
  return lineItems.map(({ product, quantity, unit_price, unit_tax, discount }) => ({ product, quantity, unit_price, unit_tax, discount }));
}

export type FirstShipmentResult =
  | {
      ok: true;
      alreadyAdjusted: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      targetQuantity: number;
    }
  | {
      ok: true;
      updated: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      previousQuantity: number;
      targetQuantity: number;
    };

export class BigblueOrderNotPendingError extends Error {
  constructor(readonly orderId: string, readonly status: string | undefined) {
    super(`Bigblue order ${orderId} is not pending`);
    this.name = "BigblueOrderNotPendingError";
  }
}

export async function processFirstShipmentAdjustment(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
  options: { requirePending?: boolean } = {},
): Promise<FirstShipmentResult> {
  const bigblueExternalIds = order.name
    ? [order.name, adjustment.shopifyOrderId]
    : [adjustment.shopifyOrderId];
  const bigblueOrder = await findBigblueOrder(
    request,
    bigblueExternalIds,
    order.created_at,
  );
  if (!bigblueOrder) {
    throw new BigblueOrderNotReadyError(bigblueExternalIds);
  }

  const status =
    typeof bigblueOrder.status === "object" &&
    bigblueOrder.status !== null &&
    "code" in bigblueOrder.status &&
    typeof bigblueOrder.status.code === "string"
      ? bigblueOrder.status.code
      : undefined;

  if (options.requirePending && status !== "PENDING") {
    throw new BigblueOrderNotPendingError(bigblueOrder.id, status);
  }

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

  logIntegrationEvent("bigblue_order_found", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    matchedExternalId: String(bigblueOrder.external_id),
    status,
    lineItems: summarizeBigblueLineItems(bigblueOrder.line_items),
  });

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

  const payload = buildUpdateOrderPayload(
    bigblueOrder,
    plan.lineItems,
    normalizeAdditionalTax,
  );
  await updateBigblueOrder(request, payload);

  const persistedOrder = await findBigblueOrder(
    request,
    bigblueExternalIds,
    order.created_at,
  );

  if (!persistedOrder) {
    throw new InvalidBigblueResponseError(
      `Updated Bigblue order ${bigblueOrder.id} could not be verified`,
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
  if (
    !normalizationPersisted || !persistedPlan.alreadyAdjusted ||
    persistedTotalCents !== shopifyTotalCents ||
    reportedPersistedTotalCents !== shopifyTotalCents ||
    !currencyPersisted
  ) {
    if (
      persistedTotalCents !== shopifyTotalCents ||
      reportedPersistedTotalCents !== shopifyTotalCents ||
      !currencyPersisted
    ) {
      logIntegrationEvent("price_mismatch", {
        stage: "persisted",
        shopifyOrderId: adjustment.shopifyOrderId,
        bigblueOrderId: bigblueOrder.id,
        shopifyTotalCents,
        calculatedBigblueTotalCents: persistedTotalCents,
        reportedBigblueTotalCents: reportedPersistedTotalCents,
        shopifyCurrency: order.currency,
        bigblueCurrency: typeof persistedOrder.currency === "string" ? persistedOrder.currency : undefined,
      });
    }
    logIntegrationEvent("update_not_persisted", {
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      pair: adjustment.pair,
      lineItems: summarizeBigblueLineItems(persistedOrder.line_items),
      additionalTax:
        typeof persistedOrder.additional_tax === "string" ||
        typeof persistedOrder.additional_tax === "number"
          ? persistedOrder.additional_tax
          : undefined,
      shopifyTotalCents,
      calculatedBigblueTotalCents: persistedTotalCents,
      reportedBigblueTotalCents: reportedPersistedTotalCents,
      currencyMatches: currencyPersisted,
    });
    throw new InvalidBigblueResponseError(
      `Updated Bigblue order ${bigblueOrder.id} did not preserve the adjustment`,
    );
  }

  logIntegrationEvent("update_verified", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    lineItems: summarizeBigblueLineItems(persistedOrder.line_items),
    additionalTax:
      typeof persistedOrder.additional_tax === "string" ||
      typeof persistedOrder.additional_tax === "number"
        ? persistedOrder.additional_tax
        : undefined,
    shopifyTotalCents,
    calculatedBigblueTotalCents: persistedTotalCents,
    reportedBigblueTotalCents: reportedPersistedTotalCents,
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
