import {
  ensureShopifyProduct,
  ensureShopifyStock,
  findProductIdForShopify,
  setCatalogExcluded,
  scrubShopifyDefaultTitleNames,
  insertShopifyMovement,
  listStores,
  rememberShopifyLocation,
  removeShelf,
  purgeUnstockedShelves,
  shopifyMovementCountAtStore,
  shopifyMovementProductIds,
  storeShelfProductIds,
} from "@/lib/data";
import {
  matchShopifyLocation,
  matchStoreForShopifyEvent,
  catalogImageJobs,
  movementsFromTransfers,
  onHandCount,
  productRefFromItem,
  salesFromOrders,
  shopifyCatalogIncluded,
  staysOnMatchedShelf,
  type ShopifyLocationInventory,
  type ShopifyOrderLine,
  type ShopifyTransferLine,
} from "@/lib/shopify-match";

export type ShopifyFeed = {
  locations: ShopifyLocationInventory[];
  orders: ShopifyOrderLine[];
  transfers: ShopifyTransferLine[];
};

export type ShopifySyncResult = {
  createdProducts: number;
  movements: number;
  storesMatched: number;
  images: Array<{ productId: number; url: string }>;
};

export function applyShopifyFeed(feed: ShopifyFeed): ShopifySyncResult {
  scrubShopifyDefaultTitleNames();
  const stores = listStores();
  let createdProducts = 0;
  let movements = 0;
  let storesMatched = 0;
  const images: Array<{ productId: number; url: string }> = [];

  function rememberImage(productId: number, url: string | null | undefined) {
    if (url?.trim()) images.push({ productId, url: url.trim() });
  }

  hideDiscontinuedAndDraft(feed);

  for (const store of stores) {
    const location = matchShopifyLocation(store.name, feed.locations);
    if (!location) continue;
    storesMatched += 1;
    rememberShopifyLocation(store.id, location.locationId);
    for (const item of location.items) {
      const ref = productRefFromItem(item);
      if (!shopifyCatalogIncluded(ref) || !ref.name) continue;
      const qty = onHandCount(item.onHand);
      if (qty <= 0) continue;
      const product = ensureShopifyProduct(ref);
      if (!product) continue;
      setCatalogExcluded(product.id, false);
      if (product.created) createdProducts += 1;
      rememberImage(product.id, ref.imageUrl);
      ensureShopifyStock(store.id, product.id, qty);
    }
  }

  for (const sale of salesFromOrders(feed.orders)) {
    const matched = stores.find((row) => matchStoreForShopifyEvent(row.name, sale.locationName));
    if (!matched) continue;
    const product = ensureShopifyProduct(sale.product);
    if (!product) continue;
    setCatalogExcluded(product.id, false);
    if (product.created) createdProducts += 1;
    rememberImage(product.id, sale.product.imageUrl);
    if (
      insertShopifyMovement({
        gid: sale.gid,
        type: "sale",
        storeId: matched.id,
        productId: product.id,
        quantity: sale.quantity,
        occurredOn: sale.occurredOn,
        unitPrice: sale.unitPrice,
        notes: sale.notes,
      })
    ) {
      movements += 1;
    }
  }

  for (const event of movementsFromTransfers(feed.transfers)) {
    const matched = stores.find((row) => matchStoreForShopifyEvent(row.name, event.locationName));
    if (!matched) continue;
    const product = ensureShopifyProduct(event.product);
    if (!product) continue;
    setCatalogExcluded(product.id, false);
    if (product.created) createdProducts += 1;
    rememberImage(product.id, event.product.imageUrl);
    if (
      insertShopifyMovement({
        gid: event.gid,
        type: event.type,
        storeId: matched.id,
        productId: product.id,
        quantity: event.quantity,
        occurredOn: event.occurredOn,
        unitPrice: null,
        notes: event.notes,
      })
    ) {
      movements += 1;
    }
  }

  for (const store of stores) {
    const location = matchShopifyLocation(store.name, feed.locations);
    if (!location) continue;
    dropShelvesShopifyDoesNotStock(store.id, location);
  }

  // A product can sit in the catalog at zero on-hand. Those rows were skipped above, so their
  // Shopify photo was never saved. Attach a photo for any catalog product the feed still names.
  for (const job of catalogImageJobs(feed.locations, findProductIdForShopify)) {
    rememberImage(job.productId, job.url);
  }

  purgeUnstockedShelves();

  return { createdProducts, movements, storesMatched, images };
}

function hideDiscontinuedAndDraft(feed: ShopifyFeed) {
  const refs = [
    ...feed.locations.flatMap((location) => location.items.map((item) => productRefFromItem(item))),
    ...feed.orders.map((order) => order.product),
    ...feed.transfers.map((transfer) => transfer.product),
  ];
  for (const ref of refs) {
    if (shopifyCatalogIncluded(ref)) continue;
    const existing = findProductIdForShopify(ref);
    if (existing) setCatalogExcluded(existing, true);
  }
}

function dropShelvesShopifyDoesNotStock(storeId: number, location: ShopifyLocationInventory) {
  const onHandByProduct = new Map<number, number>();
  const hidden = new Set<number>();
  for (const item of location.items) {
    const ref = productRefFromItem(item);
    const known = findProductIdForShopify(ref);
    if (!known) continue;
    if (!shopifyCatalogIncluded(ref)) {
      hidden.add(known);
      continue;
    }
    onHandByProduct.set(known, onHandCount(item.onHand));
  }
  const keep = new Set<number>();
  for (const [productId, qty] of onHandByProduct) {
    if (staysOnMatchedShelf(qty, shopifyMovementCountAtStore(storeId, productId))) {
      if (qty <= 0) ensureShopifyStock(storeId, productId, 0);
      keep.add(productId);
    }
  }
  for (const productId of shopifyMovementProductIds(storeId)) {
    if (keep.has(productId)) continue;
    const qty = onHandByProduct.get(productId) ?? null;
    if (!staysOnMatchedShelf(qty, shopifyMovementCountAtStore(storeId, productId))) continue;
    if (!onHandByProduct.has(productId)) ensureShopifyStock(storeId, productId, 0);
    keep.add(productId);
  }
  for (const productId of hidden) keep.add(productId);
  for (const productId of storeShelfProductIds(storeId)) {
    if (!keep.has(productId)) removeShelf(storeId, productId);
  }
}
