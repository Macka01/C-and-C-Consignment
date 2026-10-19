import { listSales } from "@/lib/data";
import { fail, json, live } from "@/lib/handlers";
import { syncFromShopify } from "@/lib/shopify-inventory";
import { shopifySyncOptions } from "@/lib/shopify-refresh";
import { queryDate, queryId } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    await syncFromShopify(shopifySyncOptions(request));
    const url = new URL(request.url);
    return json(
      listSales({
        storeId: queryId(url, "storeId"),
        from: queryDate(url, "from", "Start date"),
        to: queryDate(url, "to", "End date"),
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
