/**
 * @file Runtime validation of Bigblue API responses.
 *
 * Bigblue responses are treated as untrusted input. These parsers check only
 * the fields the integration reads and preserve every other field untouched,
 * so a parsed order can be sent back through `UpdateOrder` without data loss.
 *
 * @module lib/integrations/bigblue/parsers
 */

import { InvalidBigblueResponseError } from "@/lib/integrations/bigblue/errors";
import type {
  BigblueLineItem,
  BigblueOrder,
  ListOrdersResponse,
} from "@/lib/integrations/bigblue/types";
import { isRecord } from "@/lib/shared/guards";

/**
 * Validates a single Bigblue line item.
 *
 * @param value - Raw line item.
 * @returns The line item with a non-empty `product` and a non-negative integer `quantity`.
 * @throws {InvalidBigblueResponseError} When either field is invalid.
 */
function parseLineItem(value: unknown): BigblueLineItem {
  if (!isRecord(value)) {
    throw new InvalidBigblueResponseError("Bigblue line item must be an object");
  }

  if (typeof value.product !== "string" || value.product.length === 0) {
    throw new InvalidBigblueResponseError(
      "Bigblue line item product is invalid",
    );
  }

  if (!Number.isSafeInteger(value.quantity) || Number(value.quantity) < 0) {
    throw new InvalidBigblueResponseError(
      "Bigblue line item quantity is invalid",
    );
  }

  return {
    ...value,
    product: value.product,
    quantity: Number(value.quantity),
  };
}

/**
 * Validates a Bigblue order returned by `ListOrders`.
 *
 * @param value - Raw order object.
 * @returns The order with validated `id`, `external_id` and `line_items`;
 *   all other fields are passed through unchanged.
 * @throws {InvalidBigblueResponseError} When a required field is missing or malformed.
 */
export function parseBigblueOrder(value: unknown): BigblueOrder {
  if (!isRecord(value)) {
    throw new InvalidBigblueResponseError("Bigblue order must be an object");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new InvalidBigblueResponseError("Bigblue order id is invalid");
  }

  if (
    typeof value.external_id !== "string" &&
    typeof value.external_id !== "number"
  ) {
    throw new InvalidBigblueResponseError(
      "Bigblue order external_id is invalid",
    );
  }

  if (!Array.isArray(value.line_items)) {
    throw new InvalidBigblueResponseError(
      "Bigblue order line_items must be an array",
    );
  }

  return {
    ...value,
    id: value.id,
    external_id: value.external_id,
    line_items: value.line_items.map(parseLineItem),
  };
}

/**
 * Validates the envelope of a `ListOrders` response.
 *
 * Individual orders are left as `unknown`: callers only parse the order they
 * are looking for, so one malformed unrelated order cannot break a lookup.
 *
 * @param value - Raw response body.
 * @returns The order list (empty when omitted) and the optional next page token.
 * @throws {InvalidBigblueResponseError} When the envelope is malformed.
 */
export function parseBigblueListOrdersResponse(
  value: unknown,
): ListOrdersResponse {
  if (
    !isRecord(value) ||
    (value.orders !== undefined && !Array.isArray(value.orders))
  ) {
    throw new InvalidBigblueResponseError(
      "Bigblue ListOrders response is invalid",
    );
  }

  if (
    value.next_page_token !== undefined &&
    typeof value.next_page_token !== "string"
  ) {
    throw new InvalidBigblueResponseError(
      "Bigblue next_page_token is invalid",
    );
  }

  return {
    orders: value.orders ?? [],
    ...(value.next_page_token === undefined
      ? {}
      : { next_page_token: value.next_page_token }),
  };
}

/**
 * Reads the fulfillment status code of a Bigblue order (e.g. `"PENDING"`).
 *
 * @param order - A parsed Bigblue order.
 * @returns `order.status.code` when it is a string, otherwise `undefined`.
 */
export function readBigblueOrderStatusCode(order: BigblueOrder): string | undefined {
  return typeof order.status === "object" &&
    order.status !== null &&
    "code" in order.status &&
    typeof order.status.code === "string"
    ? order.status.code
    : undefined;
}
