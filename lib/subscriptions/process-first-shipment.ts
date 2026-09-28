import { FULFILLMENT_SETTINGS } from "@/config/fulfillment-settings";
import type { BigblueRequest } from "@/lib/bigblue/client";
import {
  buildUpdateOrderPayload,
  findBigblueOrder,
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
  planBigblueLineItemAdjustment,
  shouldClearRoundingAdditionalTax,
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

export async function processFirstShipmentAdjustment(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
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

  logIntegrationEvent("bigblue_order_found", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    matchedExternalId: String(bigblueOrder.external_id),
    status:
      typeof bigblueOrder.status === "object" &&
      bigblueOrder.status !== null &&
      "code" in bigblueOrder.status &&
      typeof bigblueOrder.status.code === "string"
        ? bigblueOrder.status.code
        : undefined,
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
  const needsUpdate = !plan.alreadyAdjusted || normalizeAdditionalTax;

  logIntegrationEvent("adjustment_planned", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    replacementEnabled: FULFILLMENT_SETTINGS.replaceExperienceSku,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
    alreadyAdjusted: !needsUpdate,
    normalizeAdditionalTax,
    before: summarizeBigblueLineItems(bigblueOrder.line_items),
    after: summarizeBigblueLineItems(plan.lineItems),
  });

  if (!needsUpdate) {
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
  if (!normalizationPersisted || !persistedPlan.alreadyAdjusted) {
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
