import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareStockToShopify,
  matchShopifyItem,
  matchShopifyLocation,
  normalizeShopifyName,
  productRefFromItem,
  keepConsigneeCode,
  shopifyProductName,
  stripShopifyDefaultTitle,
  shelfBelongsAtStore,
  staysOnMatchedShelf,
  shopifyVariance,
  type ShopifyLocationInventory,
} from "./shopify-match.ts";

const harbour: ShopifyLocationInventory = {
  locationId: "gid://shopify/Location/1",
  locationName: "Harbour Linen",
  items: [
    {
      variantId: "gid://shopify/ProductVariant/1",
      sku: "FLAX-BOWL-DE",
      title: "Flax Serve Bowl",
      variantTitle: "Duck Egg",
      displayName: "Flax Serve Bowl — Duck Egg",
      productType: "Flax ceramics",
      description: null,
      price: 15,
      onHand: 11,
    },
    {
      variantId: "gid://shopify/ProductVariant/2",
      sku: "HLB-MUG-KH",
      title: "Flax Mug",
      variantTitle: "Khaki",
      displayName: "Flax Mug — Khaki",
      productType: "Flax ceramics",
      description: null,
      price: 18,
      onHand: 4,
    },
  ],
};

describe("shopify inventory match", () => {
  it("treats punctuation and case as the same name", () => {
    assert.equal(normalizeShopifyName("Harbour  Linen"), normalizeShopifyName("harbour linen"));
    assert.equal(normalizeShopifyName("Flax Serve Bowl — Duck Egg"), "flax serve bowl duck egg");
  });

  it("drops Shopify Default Title from product names", () => {
    assert.equal(stripShopifyDefaultTitle("Handmade Ceramic Trinket Dish - Default Title"), "Handmade Ceramic Trinket Dish");
    assert.equal(stripShopifyDefaultTitle("Herb Sticks — Default Title"), "Herb Sticks");
    assert.equal(
      shopifyProductName({
        title: "Handmade Ceramic Trinket Dish",
        variantTitle: "Default Title",
        displayName: "Handmade Ceramic Trinket Dish - Default Title",
      }),
      "Handmade Ceramic Trinket Dish",
    );
    assert.equal(
      shopifyProductName({ title: "Flax Mug", variantTitle: "Khaki", displayName: "Flax Mug - Khaki" }),
      "Flax Mug — Khaki",
    );
    assert.equal(normalizeShopifyName("Bowl - Default Title"), normalizeShopifyName("Bowl"));
    assert.equal(
      productRefFromItem({
        variantId: "gid://shopify/ProductVariant/9",
        sku: "TRINKET",
        title: "Handmade Ceramic Trinket Dish",
        variantTitle: "Default Title",
        displayName: "Handmade Ceramic Trinket Dish - Default Title",
        productType: "Bowl",
        description: null,
        price: 14,
        onHand: 2,
      }).name,
      "Handmade Ceramic Trinket Dish",
    );
  });

  it("keeps a saved consignee code and treats Default Title as empty", () => {
    assert.equal(keepConsigneeCode("CS-01", "CHEESE-STICKS"), "CS-01");
    assert.equal(keepConsigneeCode("Default Title", "CS-01"), "CS-01");
    assert.equal(keepConsigneeCode("Default Title", ""), "");
    assert.equal(keepConsigneeCode("", ""), "");
    assert.equal(keepConsigneeCode("—", "CS-01"), "CS-01");
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

  it("keeps a product at a store only when Shopify has stock or a Shopify movement", () => {
    assert.equal(shelfBelongsAtStore(3, 0), true);
    assert.equal(shelfBelongsAtStore(0, 2), true);
    assert.equal(shelfBelongsAtStore(0, 0), false);
    assert.equal(shelfBelongsAtStore(Number.NaN, 0), false);
    assert.equal(staysOnMatchedShelf(null, 0), false);
    assert.equal(staysOnMatchedShelf(null, 1), true);
    assert.equal(staysOnMatchedShelf(0, 0), false);
    assert.equal(staysOnMatchedShelf(4, 0), true);
  });
});
