/**
 * @file Request authentication helpers for Route Handlers.
 *
 * @module lib/http/request-auth
 */

import { notConfiguredResponse } from "@/lib/http/responses";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { secretsMatch } from "@/lib/shared/crypto";

/** Result of {@link loadRequiredSecret}: either the secret or a ready-made error response. */
export type SecretLoadResult =
  | { ok: true; secret: string }
  | { ok: false; response: Response };

/**
 * Loads a secret needed to authenticate a request, converting a missing
 * configuration into a logged `503 not_configured` response.
 *
 * @param load - Typed getter from `config/server-env`.
 * @param variable - Variable name to report in the log (never the value).
 * @returns The secret, or the response to return immediately.
 * @sideEffects Logs `reconciliation_configuration_error` when the secret is missing.
 */
export function loadRequiredSecret(load: () => string, variable: string): SecretLoadResult {
  try {
    return { ok: true, secret: load() };
  } catch {
    logIntegrationEvent("reconciliation_configuration_error", { variable });
    return { ok: false, response: notConfiguredResponse() };
  }
}

/**
 * Checks an `Authorization: Bearer <token>` header in constant time.
 *
 * @param header - Raw `Authorization` header, or `null`.
 * @param secret - Expected token.
 * @returns `true` only for the exact `Bearer <secret>` value.
 */
export function isAuthorizedBearer(header: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return false;
  return secretsMatch(header.slice(prefix.length), secret);
}
