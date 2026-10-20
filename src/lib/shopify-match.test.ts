import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareStockToShopify,
  matchShopifyItem,
  matchShopifyLocation,
  normalizeShopifyName,
  productRefFromItem,
  keepConsigneeCode,
  shopifyCatalogName,
  shopifyProductGroup,
  shopifyProductName,
  stripShopifyDefaultTitle,
  shelfBelongsAtStore,
  staysOnMatchedShelf,
  stockLineOnShelf,
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
    assert.equal(shopifyCatalogName("Bowl - Default Title"), "Bowl");
    assert.equal(shopifyCatalogName("Default Title", "SKU-1"), "SKU-1");
    assert.equal(shopifyCatalogName("", null), "");
    assert.equal(shopifyCatalogName("Default Title", "Default Title"), "");
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
      }).productGroup,
      "Bowl",
    );
  });

  it("uses Shopify product type as the tracker group, and leaves it empty when type is blank", () => {
    assert.equal(shopifyProductGroup("Tableware - Flax"), "Tableware - Flax");
    assert.equal(shopifyProductGroup("  Handmade  "), "Handmade");
    assert.equal(shopifyProductGroup(""), "");
    assert.equal(shopifyProductGroup(null), "");
    assert.equal(
      productRefFromItem({
        variantId: "gid://shopify/ProductVariant/10",
        sku: "VASE",
        title: "Window Vase",
        variantTitle: null,
        displayName: "Window Vase",
        productType: null,
        description: null,
        price: 42,
        onHand: 1,
      }).productGroup,
      "",
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

  it("does not treat a leftover qty-0 store_stock row as stock", () => {
    const base = {
      quantity: 0,
      shopifyQtyOnHand: null as number | null,
      shopifyMatch: "matched" as const,
      transferredIn: 0,
      transferredOut: 0,
      sales: 0,
    };
    assert.equal(stockLineOnShelf({ ...base, quantity: 3 }), true);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, shopifyQtyOnHand: 0 }), false);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, shopifyQtyOnHand: 6 }), false);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, sales: 1 }), true);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, shopifyMatch: "no_product" }), false);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, shopifyMatch: "no_product", transferredIn: 4 }), true);
    assert.equal(stockLineOnShelf({ ...base, quantity: 3, shopifyMatch: "unavailable" }), true);
    assert.equal(stockLineOnShelf({ ...base, quantity: 0, shopifyMatch: "unavailable" }), false);
  });
});
