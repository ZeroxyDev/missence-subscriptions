/**
 * @file GraphQL documents for the Shopify Admin order reader.
 *
 * Only `current*` fields are used for quantities and totals: they reflect
 * order edits and refunds, unlike the original checkout values.
 *
 * @module lib/integrations/shopify/admin/queries
 */

/**
 * Line items fetched per order. Orders with more lines are rejected rather
 * than partially read, since a missing line could hide a configured product.
 */
export const LINE_ITEMS_PAGE_SIZE = 10;

/** Orders fetched per page by the reconciliation search. */
export const ORDERS_PAGE_SIZE = 10;

/** Order fields shared by the single-order and search queries. */
const ORDER_FIELDS = `
        legacyResourceId
        name
        currencyCode
        presentmentCurrencyCode
        createdAt
        cancelledAt
        edited
        displayFulfillmentStatus
        taxesIncluded
        currentTotalPriceSet {
          shopMoney { amount currencyCode }
          presentmentMoney { amount currencyCode }
        }
        lineItems(first: ${LINE_ITEMS_PAGE_SIZE}) {
          pageInfo { hasNextPage }
          nodes {
            id
            sku
            quantity
            currentQuantity
            product { legacyResourceId }
            variant { legacyResourceId }
            originalUnitPriceSet { shopMoney { amount } }
            totalDiscountSet { shopMoney { amount } }
            taxLines { priceSet { shopMoney { amount } } }
          }
        }
`;

/** Newest-first search of orders matching a Shopify search string. */
export const RECENT_ORDERS_QUERY = `
  query RecentExperienceOrders($search: String!, $after: String) {
    orders(first: ${ORDERS_PAGE_SIZE}, after: $after, query: $search, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/** Single order by global ID (`gid://shopify/Order/<id>`). */
export const ORDER_BY_ID_QUERY = `
  query ExperienceOrder($id: ID!) {
    order(id: $id) { ${ORDER_FIELDS} }
  }
`;
