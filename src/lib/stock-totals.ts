import type { Movement, MovementType, StockLine } from "@/lib/types";

export type MovementTotals = {
  transferredIn: number;
  transferredOut: number;
  sales: number;
};

export function emptyMovementTotals(): MovementTotals {
  return { transferredIn: 0, transferredOut: 0, sales: 0 };
}

export function addMovementToTotals(totals: MovementTotals, type: MovementType, quantity: number): MovementTotals {
  if (type === "transfer_in") return { ...totals, transferredIn: totals.transferredIn + quantity };
  if (type === "transfer_out") return { ...totals, transferredOut: totals.transferredOut + quantity };
  return { ...totals, sales: totals.sales + quantity };
}

export function onHandFromTotals(totals: MovementTotals) {
  return totals.transferredIn - totals.transferredOut - totals.sales;
}

/** Shopify on hand minus transfer/sale roll-forward. Covers received, counted, or opening stock. */
export function otherFromOnHand(onHand: number, totals: MovementTotals) {
  return onHand - onHandFromTotals(totals);
}

export function attachStockTotals(stock: StockLine[], movements: Movement[]): StockLine[] {
  const map = new Map<string, MovementTotals>();
  for (const movement of movements) {
    const key = `${movement.storeId}:${movement.productId}`;
    map.set(key, addMovementToTotals(map.get(key) ?? emptyMovementTotals(), movement.type, movement.quantity));
  }
  return stock.map((line) => ({
    ...line,
    ...(map.get(`${line.storeId}:${line.productId}`) ?? emptyMovementTotals()),
  }));
}
