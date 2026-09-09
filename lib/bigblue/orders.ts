import type { BigblueRequest } from "@/lib/bigblue/client";
import { BigblueApiError } from "@/lib/bigblue/client";
import type { FirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

const ORDER_SEARCH_WINDOW_MS = 60 * 60 * 1_000;
const LIST_ORDERS_PAGE_SIZE = 100;
const MAX_LIST_ORDER_PAGES = 20;

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

export type BigblueLineItem = {
  product: string;
  quantity: number;
  unit_price?: string;
  unit_tax?: string;
  discount?: string;
  [key: string]: unknown;
};

export type BigblueOrder = {
  id: string;
  external_id: string | number;
  line_items: BigblueLineItem[];
  [key: string]: unknown;
};

type ListOrdersRequest = {
  date_range: {
    from: string;
    to: string;
  };
  page_token: string;
  page_size: number;
};

type ListOrdersResponse = {
  orders: unknown[];
  next_page_token?: string;
};

export type UpdateOrderPayload = {
  order: Record<string, unknown> & {
    id: string;
    external_id: string | number;
    line_items: BigblueLineItem[];
  };
};

export type BigblueLineItemAdjustmentPlan =
  | {
      alreadyAdjusted: true;
      previousQuantity: number;
      lineItems: BigblueLineItem[];
    }
  | {
      alreadyAdjusted: false;
      previousQuantity: number;
      lineItems: BigblueLineItem[];
    };

export class InvalidBigblueResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBigblueResponseError";
  }
}

export class BigblueOrderNotReadyError extends Error {
  constructor(readonly shopifyOrderId: string) {
    super(`Bigblue order for Shopify order ${shopifyOrderId} is not ready`);
    this.name = "BigblueOrderNotReadyError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function parseOrder(value: unknown): BigblueOrder {
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

function parseListOrdersResponse(value: unknown): ListOrdersResponse {
  if (!isRecord(value) || !Array.isArray(value.orders)) {
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
    orders: value.orders,
    ...(value.next_page_token === undefined
      ? {}
      : { next_page_token: value.next_page_token }),
  };
}

function getDateRange(createdAt: string): ListOrdersRequest["date_range"] {
  const createdAtMs = Date.parse(createdAt);

  return {
    from: new Date(createdAtMs - ORDER_SEARCH_WINDOW_MS).toISOString(),
    to: new Date(createdAtMs + ORDER_SEARCH_WINDOW_MS).toISOString(),
  };
}

export async function findBigblueOrder(
  request: BigblueRequest,
  shopifyOrderId: string,
  createdAt: string,
): Promise<BigblueOrder | null> {
  const dateRange = getDateRange(createdAt);
  let pageToken = "";

  for (let page = 0; page < MAX_LIST_ORDER_PAGES; page += 1) {
    const rawResponse = await request<ListOrdersRequest, unknown>("ListOrders", {
      date_range: dateRange,
      page_token: pageToken,
      page_size: LIST_ORDERS_PAGE_SIZE,
    });
    const response = parseListOrdersResponse(rawResponse);

    for (const rawOrder of response.orders) {
      if (
        isRecord(rawOrder) &&
        String(rawOrder.external_id) === shopifyOrderId
      ) {
        return parseOrder(rawOrder);
      }
    }

    if (!response.next_page_token) {
      return null;
    }

    pageToken = response.next_page_token;
  }

  throw new InvalidBigblueResponseError(
    "Bigblue ListOrders exceeded the pagination safety limit",
  );
}

type FindWithRetryOptions = {
  delaysMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function findBigblueOrderWithRetry(
  request: BigblueRequest,
  shopifyOrderId: string,
  createdAt: string,
  {
    delaysMs = [0, 1_000, 2_000, 4_000, 8_000],
    sleep = defaultSleep,
  }: FindWithRetryOptions = {},
): Promise<BigblueOrder> {
  let retryAfterMs = 0;

  for (const delayMs of delaysMs) {
    await sleep(Math.max(delayMs, retryAfterMs));
    retryAfterMs = 0;

    try {
      const order = await findBigblueOrder(
        request,
        shopifyOrderId,
        createdAt,
      );

      if (order) {
        return order;
      }
    } catch (error) {
      if (!(error instanceof BigblueApiError) || !error.retryable) {
        throw error;
      }

      retryAfterMs = error.retryAfterMs ?? 0;
    }
  }

  throw new BigblueOrderNotReadyError(shopifyOrderId);
}

export function planBigblueLineItemAdjustment(
  lineItems: readonly BigblueLineItem[],
  adjustment: Extract<FirstShipmentAdjustment, { shouldAdjust: true }>,
): BigblueLineItemAdjustmentPlan {
  const matchingItems = lineItems.filter(
    (lineItem) => lineItem.product === adjustment.subscriptionSku,
  );
  const previousQuantity = matchingItems.reduce(
    (total, lineItem) => total + lineItem.quantity,
    0,
  );

  if (previousQuantity === adjustment.targetQuantity) {
    return {
      alreadyAdjusted: true,
      previousQuantity,
      lineItems: [...lineItems],
    };
  }

  if (adjustment.targetQuantity === 0) {
    return {
      alreadyAdjusted: false,
      previousQuantity,
      lineItems: lineItems.filter(
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
    lineItems: lineItems.map((lineItem) =>
      lineItem.product === adjustment.subscriptionSku
        ? { ...lineItem, quantity: adjustment.targetQuantity }
        : lineItem,
    ),
  };
}

export function buildUpdateOrderPayload(
  order: BigblueOrder,
  lineItems: BigblueLineItem[],
): UpdateOrderPayload {
  const mutableOrder: Record<string, unknown> = {};

  for (const field of MUTABLE_ORDER_FIELDS) {
    if (field in order) {
      mutableOrder[field] = order[field];
    }
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

export async function updateBigblueOrder(
  request: BigblueRequest,
  payload: UpdateOrderPayload,
): Promise<void> {
  await request<UpdateOrderPayload, unknown>("UpdateOrder", payload);
}

