import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMovementToTotals,
  attachStockTotals,
  emptyMovementTotals,
  onHandFromTotals,
  otherFromOnHand,
} from "./stock-totals.ts";
import type { Movement, StockLine } from "./types.ts";

describe("stock movement totals", () => {
  it("adds transfers and sales then equals on hand", () => {
    let totals = emptyMovementTotals();
    totals = addMovementToTotals(totals, "transfer_in", 12);
    totals = addMovementToTotals(totals, "transfer_out", 2);
    totals = addMovementToTotals(totals, "sale", 3);
    assert.deepEqual(totals, { transferredIn: 12, transferredOut: 2, sales: 3 });
    assert.equal(onHandFromTotals(totals), 7);
    assert.equal(otherFromOnHand(7, totals), 0);
  });

  it("treats leftover Shopify on hand as other (received or adjusted)", () => {
    const trinket = emptyMovementTotals();
    assert.equal(otherFromOnHand(2, trinket), 2);
    assert.equal(2, onHandFromTotals(trinket) + otherFromOnHand(2, trinket));

    const star = { transferredIn: 3, transferredOut: 10, sales: 0 };
    assert.equal(onHandFromTotals(star), -7);
    assert.equal(otherFromOnHand(2, star), 9);
    assert.equal(2, onHandFromTotals(star) + otherFromOnHand(2, star));
  });

  it("attaches totals for one store product", () => {
    const line = {
      id: 1,
      storeId: 4,
      productId: 9,
      consigneeCode: "HLB-BOWL-DE",
      quantity: 7,
      productName: "Flax Serve Bowl — Duck Egg",
      productGroup: "Flax ceramics",
      description: "",
      retailPrice: 15,
      shopifyQtyOnHand: 7,
      variance: 0,
      shopifyMatch: "matched",
      transferredIn: 0,
      transferredOut: 0,
      sales: 0,
    } satisfies StockLine;
    const movements = [
      { storeId: 4, productId: 9, type: "transfer_in", quantity: 12 },
      { storeId: 4, productId: 9, type: "transfer_out", quantity: 2 },
      { storeId: 4, productId: 9, type: "sale", quantity: 3 },
      { storeId: 4, productId: 8, type: "sale", quantity: 40 },
    ] as Movement[];
    const [attached] = attachStockTotals([line], movements);
    assert.deepEqual(
      { transferredIn: attached.transferredIn, transferredOut: attached.transferredOut, sales: attached.sales },
      { transferredIn: 12, transferredOut: 2, sales: 3 },
    );
  });
});
