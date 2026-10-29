/**
 * @file Building and sending Bigblue `UpdateOrder` requests.
 *
 * `UpdateOrder` replaces the whole editable order, so the payload must carry
 * every editable field back unchanged. It is rebuilt from an explicit
 * allowlist: read-only response fields (`status`, `store`, `submit_time`,
 * `total`, tracking, packages, fulfillments…) are never echoed back.
 *
 * @module lib/integrations/bigblue/order-update
 */

import type {
  BigblueLineItem,
  BigblueOrder,
  BigblueRequest,
  UpdateOrderPayload,
} from "@/lib/integrations/bigblue/types";

/** Editable fields of the Bigblue CreateOrder/UpdateOrder model. */
const MUTABLE_ORDER_FIELDS = [
  "id",
  "external_id",
  "language",
  "currency",
  "shipping_address",
  "line_items",
  "shipping_price",
  "shipping_tax",
  "additional_tax",
  "additional_discount",
  "shipping_method",
  "billing_address",
  "pickup_point",
  "b2b",
  "b2b_fulfillment_instructions_template",
  "auto_fulfill_schedule_time",
  "auto_fulfill_reservation_priority",
  "auto_fulfill_warehouse",
  "external_order_url",
  "customer_order_id",
] as const;

/**
 * Builds a full `UpdateOrder` payload from an existing order and new lines.
 *
 * @param order - Current Bigblue order, as returned by `ListOrders`.
 * @param lineItems - Replacement line items.
 * @param clearRoundingAdditionalTax - When `true`, sets `additional_tax` to
 *   `"0.00"` (see `shouldClearRoundingAdditionalTax`).
 * @returns The payload, containing only allowlisted fields.
 */
export function buildUpdateOrderPayload(
  order: BigblueOrder,
  lineItems: BigblueLineItem[],
  clearRoundingAdditionalTax = false,
): UpdateOrderPayload {
  const mutableOrder: Record<string, unknown> = {};

  for (const field of MUTABLE_ORDER_FIELDS) {
    if (field in order) {
      mutableOrder[field] = order[field];
    }
  }

  if (clearRoundingAdditionalTax) {
    mutableOrder.additional_tax = "0.00";
  }

  return {
    order: {
      ...mutableOrder,
      id: order.id,
      external_id: order.external_id,
      line_items: lineItems,
    },
  };
}

/**
 * Sends an `UpdateOrder` request. The response body is ignored: success is
 * established by re-reading the order afterwards, never by trusting the write.
 *
 * @param request - Bigblue RPC function.
 * @param payload - Payload from {@link buildUpdateOrderPayload}.
 * @returns Resolves when Bigblue accepts the request.
 * @throws {BigblueApiError} When Bigblue rejects the request.
 * @sideEffects Mutates the order in Bigblue.
 */
export async function updateBigblueOrder(
  request: BigblueRequest,
  payload: UpdateOrderPayload,
): Promise<void> {
  await request<UpdateOrderPayload, unknown>("UpdateOrder", payload);
}
