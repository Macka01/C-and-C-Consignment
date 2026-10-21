import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { listCatalogWithLocationStock } from "@/lib/shopify-inventory";
import { shopifySyncOptions } from "@/lib/shopify-refresh";

export async function GET(request: Request) {
  try {
    await live();
    return json(await listCatalogWithLocationStock(shopifySyncOptions(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  return fail(new HttpError("The catalog comes from Shopify. Add the product there.", 405));
}
