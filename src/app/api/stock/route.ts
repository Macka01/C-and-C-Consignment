import { updateConsigneeCode } from "@/lib/data";
import { HttpError } from "@/lib/errors";
import { fail, json, live, readJson } from "@/lib/handlers";
import { optionalText, positiveId } from "@/lib/validate";

export async function POST() {
  try {
    await live();
    throw new HttpError("Products are placed from Shopify when they appear at this location.", 409);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await live();
    const body = await readJson(request);
    updateConsigneeCode(
      positiveId(body.storeId, "Store"),
      positiveId(body.productId, "Product"),
      optionalText(body, "consigneeCode", "Consignee code", 80) ?? "",
    );
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
