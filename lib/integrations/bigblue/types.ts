/**
 * @file Wire types for the subset of the Bigblue Store API we use.
 *
 * Bigblue objects carry many fields we neither read nor own. The types below
 * name the fields the integration depends on and keep the rest through an
 * index signature, so that round-tripping an order through `UpdateOrder`
 * never drops data Bigblue expects back.
 *
 * Monetary fields are decimal strings (e.g. `"49.50"`).
 *
 * @see https://bigblue.notion.site/Bigblue-Store-API-Documentation-4e9c3d052a1a4b73b59709edfe8b7457
 * @module lib/integrations/bigblue/types
 */

/**
 * Generic, transport-agnostic Bigblue RPC function.
 *
 * Injected everywhere instead of a concrete client so that business logic can
 * be tested against an in-memory fake.
 *
 * @typeParam TRequest - JSON payload sent to the method.
 * @typeParam TResponse - Expected (unvalidated) JSON response.
 */
export type BigblueRequest = <TRequest, TResponse>(
  method: string,
  payload: TRequest,
) => Promise<TResponse>;

/** A logistics line of a Bigblue order. */
export type BigblueLineItem = {
  /** Bigblue product reference, equal to the Shopify SKU. */
  product: string;
  /** Units to ship. Never sent as `0`: lines are removed instead. */
  quantity: number;
  /** Net unit price (tax excluded). */
  unit_price?: string;
  /** Tax per unit. */
  unit_tax?: string;
  /** Total discount for the whole line (not per unit). */
  discount?: string;
  [key: string]: unknown;
};

/** A Bigblue order as returned by `ListOrders`. */
export type BigblueOrder = {
  /** Bigblue order ID, e.g. `"MISSS1001047"`. */
  id: string;
  /** Shopify reference: currently the order name (`"#1047"`), possibly its numeric ID. */
  external_id: string | number;
  line_items: BigblueLineItem[];
  [key: string]: unknown;
};

/** Request body of `ListOrders`. */
export type ListOrdersRequest = {
  /** Creation-time window, formatted with `formatBigblueDateTime`. */
  date_range: {
    from: string;
    to: string;
  };
  /** Empty string for the first page. */
  page_token: string;
  page_size: number;
};

/** Validated response of `ListOrders`. Orders stay `unknown` until parsed individually. */
export type ListOrdersResponse = {
  orders: unknown[];
  next_page_token?: string;
};

/** Request body of `UpdateOrder`: Bigblue requires the full editable order. */
export type UpdateOrderPayload = {
  order: Record<string, unknown> & {
    id: string;
    external_id: string | number;
    line_items: BigblueLineItem[];
  };
};
