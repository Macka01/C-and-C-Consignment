import { listProducts } from "@/lib/data";
import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { syncFromShopify } from "@/lib/shopify-inventory";
import { shopifySyncOptions } from "@/lib/shopify-refresh";

export async function GET(request: Request) {
  try {
    await live();
    await syncFromShopify(shopifySyncOptions(request));
    return json(listProducts());
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  return fail(new HttpError("The catalog comes from Shopify. Add the product there.", 405));
}
