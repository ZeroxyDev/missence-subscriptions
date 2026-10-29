/**
 * @file Exact monetary arithmetic helpers.
 *
 * All money comparisons in the integration are performed on integer cents to
 * avoid IEEE-754 drift (`0.1 + 0.2 !== 0.3`). Amounts arrive as decimal
 * strings from Shopify and Bigblue and are converted exactly once, at the edge
 * of each calculation.
 *
 * @module lib/shared/money
 */

/** Matches a signed decimal amount with at most two fractional digits. */
const DECIMAL_AMOUNT_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;

/**
 * Converts a monetary amount to integer cents.
 *
 * Accepts finite numbers and strings in plain decimal notation with at most
 * two fractional digits (e.g. `"12"`, `"-0.01"`, `"49.50"`). Negative values
 * are allowed because Bigblue reports rounding corrections such as
 * `additional_tax: "-0.01"`.
 *
 * @param value - Amount as received from an API (string or number).
 * @returns The amount in cents, or `null` when the input is not a valid,
 *   safely representable amount. Callers must treat `null` as "unverifiable"
 *   and refuse to write.
 *
 * @example
 * ```ts
 * toCents("49.50"); // 4950
 * toCents("1.005"); // null (more than two decimals)
 * toCents(undefined); // null
 * ```
 */
export function toCents(value: unknown): number | null {
  if (typeof value === "string" && !DECIMAL_AMOUNT_PATTERN.test(value)) {
    return null;
  }
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Formats an amount expressed in major units as a two-decimal string.
 *
 * @param value - Amount in major units (e.g. euros), not cents.
 * @returns The amount formatted as Bigblue expects, e.g. `"49.50"`.
 */
export function formatMoney(value: number): string {
  return value.toFixed(2);
}
