import { belongsOnStoreShelf } from "@/lib/shelf-membership";

export type ShopifyMatch = "matched" | "no_location" | "no_product" | "unavailable";

export type ShopifyInventoryItem = {
  variantId: string | null;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  displayName: string | null;
  productType: string | null;
  productStatus?: string | null;
  description: string | null;
  price: number | null;
  onHand: number;
  imageUrl?: string | null;
};

export type ShopifyProductRef = {
  variantId: string | null;
  sku: string | null;
  name: string;
  productGroup: string;
  productStatus?: string | null;
  description: string;
  retailPrice: number;
  imageUrl: string | null;
};

/** Shopify uses this for the only variant on a product with no size/colour options. */
function isPlaceholderVariantTitle(value: string | null | undefined) {
  return !value?.trim() || /^default title$/i.test(value.trim());
}

/** Drop Shopify's "Default Title" so the catalog shows the product name only. */
export function stripShopifyDefaultTitle(value: string) {
  return value
    .replace(/\s*[-–—/]\s*Default Title\s*$/gi, "")
    .replace(/^\s*Default Title\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlaceholderShopifyCode(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return !text || text === "—" || /^default title$/i.test(text);
}

/** Keep a code someone saved. Never invent one from Shopify. */
export function keepConsigneeCode(existing: string | null | undefined, incoming: string | null | undefined) {
  if (!isPlaceholderShopifyCode(existing)) return existing!.trim();
  if (!isPlaceholderShopifyCode(incoming)) return incoming!.trim();
  return "";
}

export function shopifyProductName(input: {
  title?: string | null;
  variantTitle?: string | null;
  displayName?: string | null;
}) {
  const product = stripShopifyDefaultTitle(input.title ?? "");
  const variant = isPlaceholderVariantTitle(input.variantTitle) ? "" : (input.variantTitle ?? "").trim();
  if (product && variant) {
    const productNorm = normalizeShopifyName(product);
    const variantNorm = normalizeShopifyName(variant);
    if (!productNorm.includes(variantNorm)) return `${product} — ${variant}`;
    return product;
  }
  if (product) return product;
  return stripShopifyDefaultTitle(input.displayName ?? "");
}

/** Blank, or only Shopify's Default Title, is not a catalog name. A real SKU can stand in for a missing title. */
export function shopifyCatalogName(name: string | null | undefined, sku?: string | null) {
  const cleaned = stripShopifyDefaultTitle(name ?? "").trim();
  if (cleaned) return cleaned;
  const code = sku?.trim() ?? "";
  if (code && !isPlaceholderShopifyCode(code)) return code;
  return "";
}

/** Photos for catalog rows the stock pass does not create, including shelves now at zero. */
export function catalogImageJobs(
  locations: ShopifyLocationInventory[],
  findProductId: (ref: ShopifyProductRef) => number | null,
) {
  const jobs: Array<{ productId: number; url: string }> = [];
  for (const location of locations) {
    for (const item of location.items) {
      const ref = productRefFromItem(item);
      if (!shopifyCatalogIncluded(ref) || !ref.name || !ref.imageUrl) continue;
      const existing = findProductId(ref);
      if (existing) jobs.push({ productId: existing, url: ref.imageUrl });
    }
  }
  return jobs;
}

/** Tracker product group is Shopify's product type. Empty type keeps a local group later. */
export function shopifyProductGroup(productType: string | null | undefined) {
  return productType?.trim() ?? "";
}

/**
 * Shopify catalog pull skips a discontinued product type and a draft product.
 * Archived and active products stay. A blank status is not a draft.
 */
export function shopifyCatalogIncluded(input: {
  productType?: string | null;
  productGroup?: string | null;
  productStatus?: string | null;
}) {
  const type = (input.productType ?? input.productGroup ?? "").trim();
  if (/^discontinued$/i.test(type)) return false;
  const status = (input.productStatus ?? "").trim();
  if (/^draft$/i.test(status)) return false;
  return true;
}

export function productRefFromItem(item: ShopifyInventoryItem): ShopifyProductRef {
  return {
    variantId: item.variantId,
    sku: item.sku,
    name: shopifyCatalogName(
      shopifyProductName({
        title: item.title,
        variantTitle: item.variantTitle,
        displayName: item.displayName,
      }),
      item.sku,
    ),
    productGroup: shopifyProductGroup(item.productType),
    productStatus: item.productStatus ?? null,
    description: item.description?.trim() || "",
    retailPrice: item.price ?? 0,
    imageUrl: item.imageUrl ?? null,
  };
}

export type ShopifyLocationInventory = {
  locationId: string;
  locationName: string;
  items: ShopifyInventoryItem[];
};

export function normalizeShopifyName(value: string) {
  return stripShopifyDefaultTitle(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchShopifyLocation(storeName: string, locations: ShopifyLocationInventory[]) {
  const needle = normalizeShopifyName(storeName);
  if (!needle) return null;
  const exact = locations.filter((location) => {
    const name = normalizeShopifyName(location.locationName);
    return Boolean(name) && name === needle;
  });
  if (exact.length === 1) return exact[0];
  const loose = locations.filter((location) => {
    const name = normalizeShopifyName(location.locationName);
    if (!name) return false;
    return name.includes(needle) || needle.includes(name);
  });
  return loose.length === 1 ? loose[0] : null;
}

/** Sales and transfers must name the shop. An empty location is not Love Local. */
export function matchStoreForShopifyEvent(storeName: string, locationName: string | null | undefined) {
  const needle = normalizeShopifyName(storeName);
  const name = normalizeShopifyName(locationName ?? "");
  if (!needle || !name) return false;
  return name === needle;
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

/** Original rule: qty > 0 at this store, or a sale/transfer already happened there. */
export function shelfBelongsAtStore(quantity: number, shopifyMovementCount: number) {
  return belongsOnStoreShelf(quantity, shopifyMovementCount);
}

/**
 * Shopify inventoryLevels often returns 0 at locations that never held the item.
 * That empty level is not stock. Only on-hand > 0, or a sale/transfer, keeps the row.
 */
export function staysOnMatchedShelf(onHand: number | null, shopifyMovementCount: number) {
  if (shopifyMovementCount > 0) return true;
  return onHand !== null && onHandCount(onHand) > 0;
}

export function shelfMovementCount(line: { transferredIn: number; transferredOut: number; sales: number }) {
  return line.transferredIn + line.transferredOut + line.sales;
}

/** Stock tab, listing page, and PDF: store_stock.quantity > 0, or a sale/transfer there. */
export function stockLineOnShelf(line: {
  quantity: number;
  shopifyQtyOnHand: number | null;
  shopifyMatch: ShopifyMatch;
  transferredIn: number;
  transferredOut: number;
  sales: number;
}) {
  return belongsOnStoreShelf(line.quantity, shelfMovementCount(line));
}

export type LocationOnHand = {
  locationName: string;
  quantity: number;
};

/**
 * On-hand at every Shopify location for one catalog variant, including the warehouse
 * at 63 Ferndale St. Locations with nothing on hand are left off. This does not create stores.
 */
export function locationStockForVariant(
  variantId: string | null | undefined,
  locations: ShopifyLocationInventory[] | null | undefined,
): LocationOnHand[] {
  const needle = variantId?.trim() ?? "";
  if (!needle || !locations?.length) return [];
  const rows: LocationOnHand[] = [];
  for (const location of locations) {
    const item = location.items.find((entry) => entry.variantId === needle);
    if (!item) continue;
    const quantity = onHandCount(item.onHand);
    if (quantity <= 0) continue;
    const locationName = location.locationName.trim();
    if (!locationName) continue;
    rows.push({ locationName, quantity });
  }
  rows.sort((a, b) => a.locationName.localeCompare(b.locationName, undefined, { sensitivity: "base" }));
  return rows;
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

export function locationNameFromOrder(order: {
  retailLocation?: { name: string | null } | null;
  fulfillments?: Array<{ location?: { name: string | null } | null }> | { nodes: Array<{ location?: { name: string | null } | null }> } | null;
  fulfillmentOrders?: {
    nodes: Array<{
      assignedLocation?: { name?: string | null; location?: { name: string | null } | null } | null;
    }>;
  } | null;
}): string | null {
  const retail = order.retailLocation?.name?.trim();
  if (retail) return retail;
  const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : (order.fulfillments?.nodes ?? []);
  for (const fulfillment of fulfillments) {
    const name = fulfillment.location?.name?.trim();
    if (name) return name;
  }
  for (const fulfillment of order.fulfillmentOrders?.nodes ?? []) {
    const name = fulfillment.assignedLocation?.location?.name?.trim() || fulfillment.assignedLocation?.name?.trim();
    if (name) return name;
  }
  return null;
}

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
    if (!shopifyCatalogIncluded(line.product)) continue;
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
    if (!shopifyCatalogIncluded(line.product)) continue;
    const date = day(line.occurredOn);
    const origin = line.originName.trim();
    const destination = line.destinationName.trim();
    if (origin) {
      events.push({
        gid: `${line.id}:out`,
        locationName: origin,
        type: "transfer_out",
        occurredOn: date,
        quantity: line.quantity,
        notes: `Shopify transfer to ${destination || "unknown location"}`,
        product: line.product,
      });
    }
    if (destination) {
      events.push({
        gid: `${line.id}:in`,
        locationName: destination,
        type: "transfer_in",
        occurredOn: date,
        quantity: line.quantity,
        notes: `Shopify transfer from ${origin || "unknown location"}`,
        product: line.product,
      });
    }
  }
  return events;
}
