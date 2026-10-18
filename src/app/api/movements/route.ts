import { listMovements } from "@/lib/data";
import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { queryId } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    const url = new URL(request.url);
    return json(
      listMovements({
        storeId: queryId(url, "storeId") ?? undefined,
        productId: queryId(url, "productId") ?? undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    await live();
    throw new HttpError("Stock movements come from Shopify. Record the sale or transfer there.", 409);
  } catch (error) {
    return fail(error);
  }
}
