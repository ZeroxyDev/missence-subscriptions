/**
 * @file Runtime type guards for untrusted, already-deserialized JSON.
 *
 * Every payload that crosses a process boundary (webhook bodies, third-party
 * API responses) is typed as `unknown` and narrowed with these guards before
 * any field is read. They are deliberately minimal and side-effect free.
 *
 * @module lib/shared/guards
 */

/**
 * Narrows a value to a plain JSON object (a non-null, non-array object).
 *
 * @param value - Any value, typically the output of `JSON.parse`.
 * @returns `true` when `value` can be safely indexed by string keys.
 *
 * @example
 * ```ts
 * const body: unknown = JSON.parse(raw);
 * if (isRecord(body) && typeof body.id === "string") {
 *   // body.id is a string here
 * }
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
