export type ShopifyMatch = "matched" | "no_location" | "no_product" | "unavailable";

export type ShopifyInventoryItem = {
  sku: string | null;
  title: string;
  variantTitle: string | null;
  displayName: string | null;
  onHand: number;
};

export type ShopifyLocationInventory = {
  locationId: string;
  locationName: string;
  items: ShopifyInventoryItem[];
};

export function normalizeShopifyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchShopifyLocation(storeName: string, locations: ShopifyLocationInventory[]) {
  const needle = normalizeShopifyName(storeName);
  if (!needle) return null;
  const exact = locations.filter((location) => normalizeShopifyName(location.locationName) === needle);
  if (exact.length === 1) return exact[0];
  const loose = locations.filter((location) => {
    const name = normalizeShopifyName(location.locationName);
    return name.includes(needle) || needle.includes(name);
  });
  return loose.length === 1 ? loose[0] : null;
}

function itemNames(item: ShopifyInventoryItem) {
  return [item.displayName, item.title, item.variantTitle, [item.title, item.variantTitle].filter(Boolean).join(" ")].filter(
    (value): value is string => Boolean(value),
  );
}

export function matchShopifyItem(line: { productName: string; consigneeCode: string }, location: ShopifyLocationInventory) {
  const code = normalizeShopifyName(line.consigneeCode);
  if (code) {
    const bySku = location.items.filter((item) => item.sku && normalizeShopifyName(item.sku) === code);
    if (bySku.length === 1) return bySku[0];
  }
  const product = normalizeShopifyName(line.productName);
  if (!product) return null;
  const byName = location.items.filter((item) => itemNames(item).some((name) => normalizeShopifyName(name) === product));
  return byName.length === 1 ? byName[0] : null;
}

export function shopifyVariance(shopifyQtyOnHand: number | null, ourQuantity: number) {
  return shopifyQtyOnHand === null ? null : shopifyQtyOnHand - ourQuantity;
}

export function compareStockToShopify(
  line: { storeName?: string; productName: string; consigneeCode: string; quantity: number },
  locations: ShopifyLocationInventory[] | null,
): { shopifyQtyOnHand: number | null; variance: number | null; shopifyMatch: ShopifyMatch } {
  if (!locations) {
    return { shopifyQtyOnHand: null, variance: null, shopifyMatch: "unavailable" };
  }
  const location = matchShopifyLocation(line.storeName ?? "", locations);
  if (!location) {
    return { shopifyQtyOnHand: null, variance: null, shopifyMatch: "no_location" };
  }
  const item = matchShopifyItem(line, location);
  if (!item) {
    return { shopifyQtyOnHand: null, variance: null, shopifyMatch: "no_product" };
  }
  return {
    shopifyQtyOnHand: item.onHand,
    variance: shopifyVariance(item.onHand, line.quantity),
    shopifyMatch: "matched",
  };
}
