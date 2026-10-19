import { getDashboard } from "@/lib/data";
import { fail, json, live } from "@/lib/handlers";
import { syncFromShopify } from "@/lib/shopify-inventory";
import { shopifySyncOptions } from "@/lib/shopify-refresh";

export async function GET(request: Request) {
  try {
    await live();
    await syncFromShopify(shopifySyncOptions(request));
    return json(getDashboard());
  } catch (error) {
    return fail(error);
  }
}
