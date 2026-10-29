# 0003. Exact-to-the-cent money verification before and after every write

- Status: Accepted
- Date: 2026-10-08 (records existing behaviour)

## Context

Moving value from the subscription line into the experience line must not
change the order total in Bigblue. Floating-point arithmetic, tax-inclusive
prices, line discounts and Bigblue's own rounding (`additional_tax: ±0.01`)
can each introduce one-cent differences. A wrong total in the warehouse
system is a financial and compliance issue.

## Decision

- All amounts are compared as **integer cents**.
- Bigblue's `total` formula is reproduced exactly
  (`shipping_price + shipping_tax + additional_tax − additional_discount +
  Σ(quantity × (unit_price + unit_tax) − discount)`), confirmed against live
  orders.
- Before writing: currencies must match, the customer's presentment total
  must equal the shop total, and the **planned** Bigblue total must equal
  Shopify's `total_price` exactly.
- A ±1 cent `additional_tax` residue is cleared only if that makes the total
  match exactly. No compensating amount is ever invented.
- After writing: the order is re-read; both the total recomputed from the
  persisted lines and Bigblue's reported `total` must equal Shopify's.
- Any mismatch logs `price_mismatch` / `update_not_persisted` and returns
  `503`. Success is never claimed on an unverified total.

## Consequences

- Some legitimate orders (multi-currency, unusual discounts) are refused and
  surface as alerts instead of being "fixed" incorrectly.
- Unit prices are rounded up and the remainder absorbed into the line
  discount, which keeps per-line totals exact.
