/**
 * @file Strict, path-aware readers for Shopify Admin GraphQL responses.
 *
 * Each reader validates one value and throws a {@link ShopifyAdminOrdersError}
 * naming the exact JSON path on failure, which makes schema drift easy to
 * diagnose from logs without logging the payload itself.
 *
 * @module lib/integrations/shopify/admin/response-readers
 */

import { ShopifyAdminOrdersError } from "@/lib/integrations/shopify/admin/errors";
import { isRecord } from "@/lib/shared/guards";

/** Non-negative amount with at most two decimals, as returned in `MoneyV2.amount`. */
const ADMIN_MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/**
 * Reads a JSON object.
 *
 * @param value - Raw value.
 * @param path - JSON path for the error message.
 * @returns The value as a record.
 * @throws {ShopifyAdminOrdersError} When not a plain object.
 */
export function readObject(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ShopifyAdminOrdersError(`${path} must be an object`);
  }
  return value;
}

/**
 * Reads a JSON array.
 *
 * @param value - Raw value.
 * @param path - JSON path for the error message.
 * @returns The array.
 * @throws {ShopifyAdminOrdersError} When not an array.
 */
export function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ShopifyAdminOrdersError(`${path} must be an array`);
  }
  return value;
}

/**
 * Reads a `legacyResourceId` (numeric ID serialised as a string).
 *
 * @param value - Raw value.
 * @param path - JSON path for the error message.
 * @returns A positive safe integer.
 * @throws {ShopifyAdminOrdersError} When not a positive safe integer.
 */
export function readLegacyId(value: unknown, path: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ShopifyAdminOrdersError(`${path} is invalid`);
  }
  return id;
}

/**
 * Reads `{ legacyResourceId }` from a nullable reference (e.g. a deleted product).
 *
 * @param value - Raw reference object or `null`.
 * @param path - JSON path for the error message.
 * @returns The numeric ID, or `null` when the reference is `null`.
 * @throws {ShopifyAdminOrdersError} When present but malformed.
 */
export function readOptionalLegacyId(value: unknown, path: string): number | null {
  return value === null ? null : readLegacyId(readObject(value, path).legacyResourceId, path);
}

/**
 * Reads the amount of one currency of a `MoneyBag` (`{ shopMoney, presentmentMoney }`).
 *
 * @param value - Raw `MoneyBag`.
 * @param path - JSON path for the error message.
 * @param field - Which currency to read; defaults to the shop currency.
 * @returns The amount as a decimal string.
 * @throws {ShopifyAdminOrdersError} When missing or not a valid amount.
 */
export function readMoneyBagAmount(
  value: unknown,
  path: string,
  field: "shopMoney" | "presentmentMoney" = "shopMoney",
): string {
  const amount = readObject(readObject(value, path)[field], `${path}.${field}`).amount;
  if (typeof amount !== "string" || !ADMIN_MONEY_PATTERN.test(amount)) {
    throw new ShopifyAdminOrdersError(`${path}.amount is invalid`);
  }
  return amount;
}
