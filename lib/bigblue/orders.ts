import type { FulfillmentSettings } from "@/config/fulfillment-settings";
import type { BigblueRequest } from "@/lib/bigblue/client";
import { BigblueApiError } from "@/lib/bigblue/client";
import type { FirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

const ORDER_SEARCH_WINDOW_MS = 60 * 60 * 1_000;
const LIST_ORDERS_PAGE_SIZE = 100;
const MAX_LIST_ORDER_PAGES = 20;
const MAX_RETRY_AFTER_MS = 8_000;

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

export type ListOrdersResponse = {
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

type ActionableAdjustment = Extract<
  FirstShipmentAdjustment,
  { shouldAdjust: true }
>;

export class InvalidBigblueResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBigblueResponseError";
  }
}

export class BigblueOrderNotReadyError extends Error {
  constructor(readonly externalIds: readonly string[]) {
    super(`Bigblue order for references ${externalIds.join(", ")} is not ready`);
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

function getDateRange(createdAt: string): ListOrdersRequest["date_range"] {
  const createdAtMs = Date.parse(createdAt);

  return {
    from: formatBigblueDateTime(new Date(createdAtMs - ORDER_SEARCH_WINDOW_MS)),
    to: formatBigblueDateTime(new Date(createdAtMs + ORDER_SEARCH_WINDOW_MS)),
  };
}

export function formatBigblueDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function findBigblueOrder(
  request: BigblueRequest,
  externalIds: string | readonly string[],
  createdAt: string,
): Promise<BigblueOrder | null> {
  const dateRange = getDateRange(createdAt);
  const expectedExternalIds = new Set(
    (typeof externalIds === "string" ? [externalIds] : externalIds).map(String),
  );
  let pageToken = "";

  for (let page = 0; page < MAX_LIST_ORDER_PAGES; page += 1) {
    const rawResponse = await request<ListOrdersRequest, unknown>("ListOrders", {
      date_range: dateRange,
      page_token: pageToken,
      page_size: LIST_ORDERS_PAGE_SIZE,
    });
    const response = parseBigblueListOrdersResponse(rawResponse);

    for (const rawOrder of response.orders) {
      if (
        isRecord(rawOrder) &&
        expectedExternalIds.has(String(rawOrder.external_id))
      ) {
        return parseBigblueOrder(rawOrder);
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
  externalIds: string | readonly string[],
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
        externalIds,
        createdAt,
      );

      if (order) {
        return order;
      }
    } catch (error) {
      if (!(error instanceof BigblueApiError) || !error.retryable) {
        throw error;
      }

      retryAfterMs = Math.min(error.retryAfterMs ?? 0, MAX_RETRY_AFTER_MS);
    }
  }

  throw new BigblueOrderNotReadyError(
    typeof externalIds === "string" ? [externalIds] : externalIds,
  );
}

function financialFields(pricing: ActionableAdjustment["experiencePricing"]) {
  return { unit_price: pricing.unitPrice, unit_tax: pricing.unitTax, discount: pricing.discount };
}

function matchesPricing(item: BigblueLineItem, pricing: ActionableAdjustment["experiencePricing"]) {
  return Number(item.unit_price) === Number(pricing.unitPrice) &&
    Number(item.unit_tax ?? 0) === Number(pricing.unitTax) &&
    Number(item.discount ?? 0) === Number(pricing.discount);
}

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
