import { fail, json, live } from "@/lib/handlers";
import { readShopifyActivity } from "@/lib/shopify-inventory";
import { describeShopifyStatus } from "@/lib/shopify-status";

export async function GET() {
  try {
    await live();
    return json(describeShopifyStatus(await readShopifyActivity()));
  } catch (error) {
    return fail(error);
  }
}
