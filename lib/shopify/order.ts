export type ShopifyTaxLine = {
  price: string;
};

export type ShopifyOrderLineItem = {
  id: number;
  variant_id: number | null;
  sku: string | null;
  quantity: number;
  price: string;
  total_discount: string;
  tax_lines: ShopifyTaxLine[];
};

export type ShopifyOrder = {
  id: number;
  name?: string;
  created_at: string;
  line_items: ShopifyOrderLineItem[];
};

export class InvalidShopifyOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidShopifyOrderError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function parseLineItem(value: unknown, index: number): ShopifyOrderLineItem {
  if (!isRecord(value)) {
    throw new InvalidShopifyOrderError(`line_items[${index}] must be an object`);
  }

  const {
    id,
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

  return {
    id: Number(value.id),
    ...(value.name === undefined ? {} : { name: value.name }),
    created_at: value.created_at,
    line_items: value.line_items.map(parseLineItem),
  };
}
