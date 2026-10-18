import { getDashboard } from "@/lib/data";
import { fail, json, live } from "@/lib/handlers";
import { syncFromShopify } from "@/lib/shopify-inventory";

export async function GET() {
  try {
    await live();
    await syncFromShopify();
    return json(getDashboard());
  } catch (error) {
    return fail(error);
  }
}
