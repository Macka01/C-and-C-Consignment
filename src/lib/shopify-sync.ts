import {
  ensureShopifyProduct,
  ensureShopifyStock,
  findProductIdForShopify,
  insertShopifyMovement,
  listStores,
  rememberShopifyLocation,
  removeShelf,
  shopifyMovementCountAtStore,
  shopifyMovementProductIds,
  storeShelfProductIds,
} from "@/lib/data";
import {
  matchShopifyLocation,
  movementsFromTransfers,
  onHandCount,
  productRefFromItem,
  salesFromOrders,
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
};

export function applyShopifyFeed(feed: ShopifyFeed): ShopifySyncResult {
  const stores = listStores();
  let createdProducts = 0;
  let movements = 0;
  let storesMatched = 0;

  for (const store of stores) {
    const location = matchShopifyLocation(store.name, feed.locations);
    if (!location) continue;
    storesMatched += 1;
    rememberShopifyLocation(store.id, location.locationId);
    for (const item of location.items) {
      const ref = productRefFromItem(item);
      if (!ref.name && !ref.sku && !ref.variantId) continue;
      const qty = onHandCount(item.onHand);
      if (qty <= 0) continue;
      const product = ensureShopifyProduct(ref);
      if (product.created) createdProducts += 1;
      ensureShopifyStock(store.id, product.id, ref.sku ?? "", qty);
    }
  }

  for (const sale of salesFromOrders(feed.orders)) {
    const matched = stores.find((row) =>
      matchShopifyLocation(row.name, [{ locationId: "", locationName: sale.locationName, items: [] }]),
    );
    if (!matched) continue;
    const product = ensureShopifyProduct(sale.product);
    if (product.created) createdProducts += 1;
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
    const matched = stores.find((row) => matchShopifyLocation(row.name, [{ locationId: "", locationName: event.locationName, items: [] }]));
    if (!matched) continue;
    const product = ensureShopifyProduct(event.product);
    if (product.created) createdProducts += 1;
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

  return { createdProducts, movements, storesMatched };
}

function dropShelvesShopifyDoesNotStock(storeId: number, location: ShopifyLocationInventory) {
  const onHandByProduct = new Map<number, number>();
  for (const item of location.items) {
    const ref = productRefFromItem(item);
    const known = findProductIdForShopify(ref);
    if (!known) continue;
    onHandByProduct.set(known, onHandCount(item.onHand));
  }
  const keep = new Set<number>();
  for (const [productId, qty] of onHandByProduct) {
    if (staysOnMatchedShelf(qty, shopifyMovementCountAtStore(storeId, productId))) {
      if (qty <= 0) ensureShopifyStock(storeId, productId, "", 0);
      keep.add(productId);
    }
  }
  for (const productId of shopifyMovementProductIds(storeId)) {
    if (keep.has(productId)) continue;
    const qty = onHandByProduct.get(productId) ?? null;
    if (!staysOnMatchedShelf(qty, shopifyMovementCountAtStore(storeId, productId))) continue;
    if (!onHandByProduct.has(productId)) ensureShopifyStock(storeId, productId, "", 0);
    keep.add(productId);
  }
  for (const productId of storeShelfProductIds(storeId)) {
    if (!keep.has(productId)) removeShelf(storeId, productId);
  }
}
