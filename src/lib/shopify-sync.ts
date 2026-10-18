import {
  ensureShopifyProduct,
  ensureShopifyStock,
  findProductIdForShopify,
  insertShopifyMovement,
  listStores,
  rememberShopifyLocation,
} from "@/lib/data";
import {
  matchShopifyLocation,
  movementsFromTransfers,
  productRefFromItem,
  salesFromOrders,
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
      if (item.onHand <= 0) {
        const known = findProductIdForShopify(ref);
        if (known) ensureShopifyStock(store.id, known, ref.sku ?? "", 0);
        continue;
      }
      const product = ensureShopifyProduct(ref);
      if (product.created) createdProducts += 1;
      ensureShopifyStock(store.id, product.id, ref.sku ?? "", item.onHand);
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

  return { createdProducts, movements, storesMatched };
}
