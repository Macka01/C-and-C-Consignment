import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesStockSearch } from "./stock-search.ts";

const bowl = {
  productName: "Dessert bowl",
  productGroup: "Tableware",
  description: "Speckled glaze",
  consigneeCode: "HLB-BOWL-DE",
};

describe("store stock search", () => {
  it("shows every product when the box is empty", () => {
    assert.equal(matchesStockSearch(bowl, ""), true);
    assert.equal(matchesStockSearch(bowl, "   "), true);
  });

  it("matches name, group, description, or consignee code", () => {
    assert.equal(matchesStockSearch(bowl, "dessert"), true);
    assert.equal(matchesStockSearch(bowl, "table"), true);
    assert.equal(matchesStockSearch(bowl, "speckled"), true);
    assert.equal(matchesStockSearch(bowl, "hlb-bowl"), true);
  });

  it("hides products that do not match", () => {
    assert.equal(matchesStockSearch(bowl, "pitcher"), false);
  });
});
