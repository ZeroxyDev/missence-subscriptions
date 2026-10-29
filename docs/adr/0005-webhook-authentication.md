# 0005. Webhook authentication on the raw body; derived Bigblue URL token

- Status: Accepted
- Date: 2026-10-08 (records existing behaviour)

## Context

All endpoints are public URLs that can trigger writes to Bigblue.

## Decision

- **Shopify**: verify `X-Shopify-Hmac-SHA256` with the app client secret on
  the **raw** request body, before parsing, with a constant-time comparison.
  The order-events endpoint additionally pins `X-Shopify-Shop-Domain` to the
  configured `*.myshopify.com` store.
- **Bigblue**: verify `X-Bigblue-Hmac-SHA256` with the app *Shared secret* on
  the raw body for `ORDER_STATUS_UPDATE`. The `URL_VERIFICATION` handshake
  may be unsigned; if signed, the signature must be valid, and only a strict
  `{"challenge": "…"}` body is echoed back.
- **Bigblue URL token (optional)**: authenticated `GET` probes use a token
  derived as `HMAC-SHA256(BIGBLUE_WEBHOOK_KEY, "missence-bigblue-order-status-url-v1")`,
  so the reusable secret never appears in a URL. Changing the context string
  rotates every configured URL.
- **Cron**: `Authorization: Bearer <RECONCILIATION_CRON_SECRET>`, compared by
  hashing both values first so the comparison is constant-time regardless of
  length.
- Every handler that needs `node:crypto` declares `runtime = "nodejs"`.

## Consequences

- Secrets are read lazily per request; a missing secret yields `503
  not_configured` (or `500` on `orders/create`), not a crashed deployment.
- Rotating `BIGBLUE_WEBHOOK_KEY` changes the derived URL token.
