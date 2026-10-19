import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesProductSearch, matchesStockSearch } from "./stock-search.ts";

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

describe("catalog product search", () => {
  const mug = {
    name: "Flax Mug — Khaki",
    productGroup: "Flax ceramics",
    description: "Everyday mug",
  };

  it("matches name, group, or description", () => {
    assert.equal(matchesProductSearch(mug, ""), true);
    assert.equal(matchesProductSearch(mug, "khaki"), true);
    assert.equal(matchesProductSearch(mug, "ceramics"), true);
    assert.equal(matchesProductSearch(mug, "everyday"), true);
    assert.equal(matchesProductSearch(mug, "bowl"), false);
  });
});
