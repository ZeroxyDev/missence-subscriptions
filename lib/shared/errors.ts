/**
 * @file Error helpers safe for structured logging.
 *
 * @module lib/shared/errors
 */

/**
 * Returns a log-safe identifier for a caught error.
 *
 * Only the error class name is exposed (e.g. `"BigblueApiError"`), never the
 * message, because messages may contain customer or order data. Operators
 * filter on these names, so error classes must keep their `name` stable.
 *
 * @param error - Any value caught in a `catch` clause.
 * @returns The error's `name`, or `"unknown_error"` for non-`Error` throwables.
 */
export function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : "unknown_error";
}
