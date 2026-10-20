/**
 * Stock tab, listing page, and PDF share this membership rule.
 * A leftover store_stock row is not enough: qty must be > 0 at that store,
 * or there must be a sale/transfer for that store_id + product_id.
 */
export function belongsOnStoreShelf(quantity: number, movementCount: number) {
  const qty = Number(quantity);
  const onHand = Number.isFinite(qty) ? Math.max(0, Math.round(qty)) : 0;
  return onHand > 0 || movementCount > 0;
}

/** Alias `st` is the store_stock row in listStock / listing SQL. */
export const BELONGS_ON_STORE_SHELF_SQL = `
  st.quantity > 0 OR EXISTS (
    SELECT 1 FROM movements m
    WHERE m.store_id = st.store_id AND m.product_id = st.product_id
  )
`;

/**
 * Leftover cleanup only, after bogus empty-location movements are gone.
 * Qty 0 with a blank code still stays if a real Love Local sale/transfer remains.
 * Listing membership is qty > 0 or a sale/transfer — not “has a code”.
 */
export const UNSTOCKED_SHELF_PREDICATE_SQL = `
  (quantity IS NULL OR quantity = 0)
  AND TRIM(COALESCE(consignee_code, '')) = ''
  AND NOT EXISTS (
    SELECT 1 FROM movements m
    WHERE m.store_id = store_stock.store_id AND m.product_id = store_stock.product_id
  )
`;

export const DELETE_UNSTOCKED_SHELF_SQL = `
  DELETE FROM store_stock
  WHERE ${UNSTOCKED_SHELF_PREDICATE_SQL}
`;
