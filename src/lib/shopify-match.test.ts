import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareStockToShopify,
  matchShopifyItem,
  matchShopifyLocation,
  normalizeShopifyName,
  shopifyVariance,
  type ShopifyLocationInventory,
} from "./shopify-match.ts";

const harbour: ShopifyLocationInventory = {
  locationId: "gid://shopify/Location/1",
  locationName: "Harbour Linen",
  items: [
    {
      sku: "FLAX-BOWL-DE",
      title: "Flax Serve Bowl",
      variantTitle: "Duck Egg",
      displayName: "Flax Serve Bowl — Duck Egg",
      onHand: 11,
    },
    {
      sku: "HLB-MUG-KH",
      title: "Flax Mug",
      variantTitle: "Khaki",
      displayName: "Flax Mug — Khaki",
      onHand: 4,
    },
  ],
};

describe("shopify inventory match", () => {
  it("treats punctuation and case as the same name", () => {
    assert.equal(normalizeShopifyName("Harbour  Linen"), normalizeShopifyName("harbour linen"));
    assert.equal(normalizeShopifyName("Flax Serve Bowl — Duck Egg"), "flax serve bowl duck egg");
  });

  it("matches a store to a Shopify location by name", () => {
    assert.equal(matchShopifyLocation("Harbour Linen", [harbour])?.locationName, "Harbour Linen");
    assert.equal(matchShopifyLocation("Unknown Shop", [harbour]), null);
  });

  it("matches a product by consignee code to SKU, then by name", () => {
    assert.equal(matchShopifyItem({ productName: "Flax Mug — Khaki", consigneeCode: "HLB-MUG-KH" }, harbour)?.onHand, 4);
    assert.equal(
      matchShopifyItem({ productName: "Flax Serve Bowl — Duck Egg", consigneeCode: "" }, harbour)?.onHand,
      11,
    );
    assert.equal(matchShopifyItem({ productName: "Missing Bowl", consigneeCode: "" }, harbour), null);
  });

  it("variance is Shopify on hand minus our quantity", () => {
    assert.equal(shopifyVariance(11, 10), 1);
    assert.equal(shopifyVariance(4, 5), -1);
    assert.equal(shopifyVariance(null, 5), null);
  });

  it("compares a stock line without changing our quantity", () => {
    const compared = compareStockToShopify(
      { storeName: "Harbour Linen", productName: "Flax Mug — Khaki", consigneeCode: "HLB-MUG-KH", quantity: 5 },
      [harbour],
    );
    assert.deepEqual(compared, { shopifyQtyOnHand: 4, variance: -1, shopifyMatch: "matched" });
    assert.equal(
      compareStockToShopify(
        { storeName: "Harbour Linen", productName: "Mystery", consigneeCode: "", quantity: 2 },
        [harbour],
      ).shopifyMatch,
      "no_product",
    );
    assert.equal(compareStockToShopify({ productName: "X", consigneeCode: "", quantity: 1 }, null).shopifyMatch, "unavailable");
  });
});
