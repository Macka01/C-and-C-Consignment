import { deleteStore, getStoreDetail, updateStore } from "@/lib/data";
import { fail, json, live, readJson, type IdContext } from "@/lib/handlers";
import { parseStore } from "@/lib/parse";
import { positiveId } from "@/lib/validate";

export async function GET(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    return json(getStoreDetail(positiveId(id, "Store")));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    return json(updateStore(positiveId(id, "Store"), parseStore(await readJson(request))));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    deleteStore(positiveId(id, "Store"));
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
