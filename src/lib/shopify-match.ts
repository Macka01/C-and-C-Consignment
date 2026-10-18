export type ShopifyMatch = "matched" | "no_location" | "no_product" | "unavailable";

export type ShopifyInventoryItem = {
  variantId: string | null;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  displayName: string | null;
  productType: string | null;
  description: string | null;
  price: number | null;
  onHand: number;
};

export type ShopifyProductRef = {
  variantId: string | null;
  sku: string | null;
  name: string;
  productGroup: string;
  description: string;
  retailPrice: number;
};

export function productRefFromItem(item: ShopifyInventoryItem): ShopifyProductRef {
  const name = item.displayName?.trim() || [item.title, item.variantTitle].filter(Boolean).join(" — ") || item.title;
  return {
    variantId: item.variantId,
    sku: item.sku,
    name,
    productGroup: item.productType?.trim() || "Shopify",
    description: item.description?.trim() || "",
    retailPrice: item.price ?? 0,
  };
}

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

export function onHandCount(value: number) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.round(qty));
}

/** A shelf row belongs at a store when Shopify still has some there, or a Shopify sale/transfer already happened. */
export function shelfBelongsAtStore(quantity: number, shopifyMovementCount: number) {
  return onHandCount(quantity) > 0 || shopifyMovementCount > 0;
}

/** onHand is null when Shopify does not list the product at this location. */
export function staysOnMatchedShelf(onHand: number | null, shopifyMovementCount: number) {
  if (shopifyMovementCount > 0) return true;
  return onHand !== null && onHandCount(onHand) > 0;
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

export type ShopifySaleEvent = {
  gid: string;
  locationName: string;
  occurredOn: string;
  quantity: number;
  unitPrice: number | null;
  notes: string;
  product: ShopifyProductRef;
};

export type ShopifyTransferEvent = {
  gid: string;
  locationName: string;
  type: "transfer_in" | "transfer_out";
  occurredOn: string;
  quantity: number;
  notes: string;
  product: ShopifyProductRef;
};

export type ShopifyOrderLine = {
  id: string;
  orderName: string;
  createdAt: string;
  cancelled: boolean;
  locationName: string | null;
  quantity: number;
  unitPrice: number | null;
  product: ShopifyProductRef;
};

export type ShopifyTransferLine = {
  id: string;
  status: string;
  occurredOn: string;
  originName: string;
  destinationName: string;
  quantity: number;
  product: ShopifyProductRef;
};

function day(iso: string) {
  return iso.slice(0, 10);
}

export function salesFromOrders(orders: ShopifyOrderLine[]): ShopifySaleEvent[] {
  const sales: ShopifySaleEvent[] = [];
  for (const line of orders) {
    if (line.cancelled || !line.locationName || line.quantity <= 0) continue;
    sales.push({
      gid: line.id,
      locationName: line.locationName,
      occurredOn: day(line.createdAt),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      notes: `Shopify ${line.orderName}`,
      product: line.product,
    });
  }
  return sales;
}

export function movementsFromTransfers(transfers: ShopifyTransferLine[]): ShopifyTransferEvent[] {
  const events: ShopifyTransferEvent[] = [];
  for (const line of transfers) {
    const status = line.status.toLowerCase();
    if (status.includes("cancel") || status === "draft" || line.quantity <= 0) continue;
    const date = day(line.occurredOn);
    events.push({
      gid: `${line.id}:out`,
      locationName: line.originName,
      type: "transfer_out",
      occurredOn: date,
      quantity: line.quantity,
      notes: `Shopify transfer to ${line.destinationName}`,
      product: line.product,
    });
    events.push({
      gid: `${line.id}:in`,
      locationName: line.destinationName,
      type: "transfer_in",
      occurredOn: date,
      quantity: line.quantity,
      notes: `Shopify transfer from ${line.originName}`,
      product: line.product,
    });
  }
  return events;
}
