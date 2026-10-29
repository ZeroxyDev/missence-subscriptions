/**
 * @file Date formatting accepted by the Bigblue Store API.
 *
 * @module lib/integrations/bigblue/datetime
 */

/**
 * Formats a date as an RFC 3339 UTC timestamp without milliseconds.
 *
 * @param date - Any valid `Date`.
 * @returns A timestamp such as `"2026-09-28T16:54:30Z"`.
 */
export function formatBigblueDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
