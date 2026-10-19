import { createProduct, listProducts } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseProduct } from "@/lib/parse";
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

export async function POST(request: Request) {
  try {
    await live();
    return json(createProduct(parseProduct(await readJson(request))), 201);
  } catch (error) {
    return fail(error);
  }
}
