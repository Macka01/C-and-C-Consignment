import { deleteInvoice, updateInvoice } from "@/lib/data";
import { fail, json, live, readJson, type IdContext } from "@/lib/handlers";
import { parseInvoice } from "@/lib/parse";
import { positiveId } from "@/lib/validate";

export async function PATCH(request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    return json(updateInvoice(positiveId(id, "Invoice"), parseInvoice(await readJson(request))));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    deleteInvoice(positiveId(id, "Invoice"));
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
