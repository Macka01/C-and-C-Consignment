import { createProduct, listProducts } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseProduct } from "@/lib/parse";
import { syncFromShopify } from "@/lib/shopify-inventory";

export async function GET() {
  try {
    await live();
    await syncFromShopify();
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
