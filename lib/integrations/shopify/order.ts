/**
 * @file Canonical Shopify order model and its validating parser.
 *
 * `ShopifyOrder` mirrors the REST webhook payload (`orders/create`). The Admin
 * GraphQL reader maps its responses into this same shape, so the domain layer
 * has a single input model regardless of how the order was obtained.
 *
 * @module lib/integrations/shopify/order
 */

import { isRecord } from "@/lib/shared/guards";

/** ISO 4217 currency code, e.g. `EUR`. */
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/** One tax line of a Shopify line item. */
export type ShopifyTaxLine = {
  /** Tax amount for the whole line (all units), decimal string. */
  price: string;
};

/** A Shopify order line item (subset used by the integration). */
export type ShopifyOrderLineItem = {
  id: number;
  /** `null` for custom or deleted products. */
  product_id: number | null;
  /** `null` for custom or deleted variants. */
  variant_id: number | null;
  sku: string | null;
  /** Current units. For Admin reads this is `currentQuantity` (after edits). */
  quantity: number;
  /** Unit price; tax-inclusive when the order's `taxes_included` is `true`. */
  price: string;
  /** Discount for the whole line. */
  total_discount: string;
  tax_lines: ShopifyTaxLine[];
};

/** A Shopify order (subset used by the integration). */
export type ShopifyOrder = {
  /** Numeric order ID. */
  id: number;
  /** Visible order name, e.g. `"#1047"`; Bigblue stores it as `external_id`. */
  name?: string;
  /** Shop currency. */
  currency?: string;
  /** Currency the customer paid in. */
  presentment_currency?: string;
  /** Total in the customer's currency. */
  presentment_total_price?: string;
  taxes_included?: boolean;
  /** Total in the shop currency; the reference amount Bigblue must match. */
  total_price?: string;
  created_at: string;
  line_items: ShopifyOrderLineItem[];
};

/** The webhook body (or mapped Admin response) is not a valid order. */
export class InvalidShopifyOrderError extends Error {
  /**
   * @param message - Which field failed validation (never its value).
   */
  constructor(message: string) {
    super(message);
    this.name = "InvalidShopifyOrderError";
  }
}

/**
 * Validates a non-negative decimal amount string.
 *
 * @param value - Raw amount.
 * @param path - Field path for the error message.
 * @returns The original string, unchanged.
 * @throws {InvalidShopifyOrderError} When not a finite, non-negative number string.
 */
function parseMoney(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0
  ) {
    throw new InvalidShopifyOrderError(`${path} is invalid`);
  }

  return value;
}

/**
 * Validates the `tax_lines` array of a line item.
 *
 * @param value - Raw tax lines.
 * @param path - Field path for error messages.
 * @returns Parsed tax lines.
 * @throws {InvalidShopifyOrderError} On a malformed entry.
 */
function parseTaxLines(value: unknown, path: string): ShopifyTaxLine[] {
  if (!Array.isArray(value)) {
    throw new InvalidShopifyOrderError(`${path} must be an array`);
  }

  return value.map((taxLine, index) => {
    if (!isRecord(taxLine)) {
      throw new InvalidShopifyOrderError(`${path}[${index}] must be an object`);
    }

    return {
      price: parseMoney(taxLine.price, `${path}[${index}].price`),
    };
  });
}

/**
 * Validates one line item.
 *
 * @param value - Raw line item.
 * @param index - Position, for error messages.
 * @returns The parsed line item.
 * @throws {InvalidShopifyOrderError} On any invalid field.
 */
function parseLineItem(value: unknown, index: number): ShopifyOrderLineItem {
  if (!isRecord(value)) {
    throw new InvalidShopifyOrderError(`line_items[${index}] must be an object`);
  }

  const {
    id,
    product_id: productId,
    variant_id: variantId,
    sku,
    quantity,
    price,
    total_discount: totalDiscount,
    tax_lines: taxLines,
  } = value;

  if (!Number.isSafeInteger(id)) {
    throw new InvalidShopifyOrderError(`line_items[${index}].id is invalid`);
  }

  if (productId !== null && !Number.isSafeInteger(productId)) {
    throw new InvalidShopifyOrderError(
      `line_items[${index}].product_id is invalid`,
    );
  }

  if (variantId !== null && !Number.isSafeInteger(variantId)) {
    throw new InvalidShopifyOrderError(
      `line_items[${index}].variant_id is invalid`,
    );
  }

  if (sku !== null && typeof sku !== "string") {
    throw new InvalidShopifyOrderError(`line_items[${index}].sku is invalid`);
  }

  if (!Number.isSafeInteger(quantity) || Number(quantity) < 0) {
    throw new InvalidShopifyOrderError(
      `line_items[${index}].quantity is invalid`,
    );
  }

  return {
    id: Number(id),
    product_id: productId === null ? null : Number(productId),
    variant_id: variantId === null ? null : Number(variantId),
    sku: sku === null ? null : String(sku),
    quantity: Number(quantity),
    price: parseMoney(price, `line_items[${index}].price`),
    total_discount: parseMoney(
      totalDiscount,
      `line_items[${index}].total_discount`,
    ),
    tax_lines: parseTaxLines(taxLines, `line_items[${index}].tax_lines`),
  };
}

/**
 * Parses and validates a raw Shopify order JSON document.
 *
 * Must only be called after the webhook HMAC has been verified on the same
 * raw string.
 *
 * The presentment total is read from `total_price_set.presentment_money`
 * (REST webhook shape) or from the flat `presentment_total_price` (Admin
 * mapper shape); the flat field wins when both are present.
 *
 * @param rawBody - Raw JSON text.
 * @returns The validated order; optional fields are omitted when absent.
 * @throws {InvalidShopifyOrderError} On invalid JSON or any invalid field.
 */
export function parseShopifyOrder(rawBody: string): ShopifyOrder {
  let value: unknown;

  try {
    value = JSON.parse(rawBody);
  } catch {
    throw new InvalidShopifyOrderError("Webhook body is not valid JSON");
  }

  if (!isRecord(value)) {
    throw new InvalidShopifyOrderError("Webhook body must be an object");
  }

  if (!Number.isSafeInteger(value.id)) {
    throw new InvalidShopifyOrderError("Order id is invalid");
  }

  if (
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at))
  ) {
    throw new InvalidShopifyOrderError("Order created_at is invalid");
  }

  if (!Array.isArray(value.line_items)) {
    throw new InvalidShopifyOrderError("Order line_items must be an array");
  }

  if (value.name !== undefined && typeof value.name !== "string") {
    throw new InvalidShopifyOrderError("Order name is invalid");
  }

  if (value.currency !== undefined && (
    typeof value.currency !== "string" || !CURRENCY_CODE_PATTERN.test(value.currency)
  )) {
    throw new InvalidShopifyOrderError("Order currency is invalid");
  }

  if (value.presentment_currency !== undefined && (
    typeof value.presentment_currency !== "string" || !CURRENCY_CODE_PATTERN.test(value.presentment_currency)
  )) {
    throw new InvalidShopifyOrderError("Order presentment_currency is invalid");
  }

  if (value.taxes_included !== undefined && typeof value.taxes_included !== "boolean") {
    throw new InvalidShopifyOrderError("Order taxes_included is invalid");
  }

  const totalPrice = value.total_price === undefined
    ? undefined
    : parseMoney(value.total_price, "Order total_price");
  let presentmentTotalPrice: string | undefined;
  if (value.total_price_set !== undefined) {
    const set = value.total_price_set;
    if (!isRecord(set) || !isRecord(set.presentment_money)) {
      throw new InvalidShopifyOrderError("Order total_price_set is invalid");
    }
    presentmentTotalPrice = parseMoney(
      set.presentment_money.amount,
      "Order total_price_set.presentment_money.amount",
    );
  }
  if (value.presentment_total_price !== undefined) {
    presentmentTotalPrice = parseMoney(value.presentment_total_price, "Order presentment_total_price");
  }

  return {
    ...(value.taxes_included === undefined ? {} : { taxes_included: value.taxes_included }),
    ...(totalPrice === undefined ? {} : { total_price: totalPrice }),
    id: Number(value.id),
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.currency === undefined ? {} : { currency: value.currency }),
    ...(value.presentment_currency === undefined ? {} : { presentment_currency: value.presentment_currency }),
    ...(presentmentTotalPrice === undefined ? {} : { presentment_total_price: presentmentTotalPrice }),
    created_at: value.created_at,
    line_items: value.line_items.map(parseLineItem),
  };
}
