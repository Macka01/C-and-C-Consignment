import { placeProduct, updateConsigneeCode } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parsePlacement } from "@/lib/parse";
import { optionalText, positiveId } from "@/lib/validate";

export async function POST(request: Request) {
  try {
    await live();
    placeProduct(parsePlacement(await readJson(request)));
    return json({ ok: true }, 201);
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
