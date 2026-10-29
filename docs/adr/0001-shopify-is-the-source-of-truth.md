# 0001. Shopify is the source of truth; only the Bigblue logistics copy is adjusted

- Status: Accepted
- Date: 2026-10-08 (records existing behaviour)

## Context

A first-shipment order contains a subscription product and an experience
product that physically includes one subscription unit. Shipping both as
recorded would ship one unit too many per experience. The fix could be made
in Shopify (edit the order or its fulfillment orders) or in Bigblue (the
warehouse's copy of the order).

Shopify owns money, taxes, subscription contracts and customer-facing
records. Editing them risks refunds, accounting differences and broken
subscription renewals.

## Decision

The integration never modifies Shopify orders, subscription contracts,
prices, discounts, payments or fulfillment orders. It only rewrites the
Bigblue logistics copy, and only while Bigblue reports `PENDING`.

## Consequences

- Shopify reports, invoices and customer communication stay untouched.
- Bigblue's copy intentionally differs from Shopify in SKU and quantities,
  while keeping the same total value (see [ADR-0003](0003-exact-money-verification.md)).
- If Bigblue starts preparing an order before it is corrected, the service
  cannot fix it automatically; operators must intervene (see the runbook).
