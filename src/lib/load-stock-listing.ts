import { getStoreDetail } from "@/lib/data";
import { withShopifyStock } from "@/lib/shopify-inventory";
import type { ShopifySyncOptions } from "@/lib/shopify-refresh";
import { buildStockListing, calendarDateInSydney, type StockListing } from "@/lib/stock-listing";

/** Same store stock the Stock tab uses: on-hand or a prior sale/transfer at that location. */
export async function loadStoreStockForListing(storeId: number, options?: ShopifySyncOptions) {
  return withShopifyStock(() => getStoreDetail(storeId), options);
}

/** Page and PDF both build from that Stock tab set. Wait so Shopify on-hand is attached. */
export async function loadStockListing(storeId: number): Promise<StockListing> {
  const detail = await loadStoreStockForListing(storeId, { wait: true });
  return buildStockListing(detail.store.name, calendarDateInSydney(), detail.stock);
}
