import { deleteProduct, getProductDetail, updateProduct } from "@/lib/data";
import { fail, json, live, readJson, type IdContext } from "@/lib/handlers";
import { parseProduct } from "@/lib/parse";
import { withShopifyStock } from "@/lib/shopify-inventory";
import { positiveId } from "@/lib/validate";

export async function GET(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    return json(await withShopifyStock(getProductDetail(positiveId(id, "Product"))));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    return json(updateProduct(positiveId(id, "Product"), parseProduct(await readJson(request))));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    deleteProduct(positiveId(id, "Product"));
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
