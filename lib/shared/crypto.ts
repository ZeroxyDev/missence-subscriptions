/**
 * @file Constant-time secret comparison.
 *
 * @module lib/shared/crypto
 */

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares two secrets in constant time, regardless of their lengths.
 *
 * Both inputs are hashed with SHA-256 first so that `timingSafeEqual` always
 * receives equal-length buffers. This prevents leaking the expected secret's
 * length through an early length-mismatch return.
 *
 * @param supplied - Untrusted value received from the caller.
 * @param expected - Trusted secret loaded from configuration.
 * @returns `true` only when both strings are identical.
 */
export function secretsMatch(supplied: string, expected: string): boolean {
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
