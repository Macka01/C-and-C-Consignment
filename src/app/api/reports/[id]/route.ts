import { deleteReport } from "@/lib/data";
import { fail, json, live, type IdContext } from "@/lib/handlers";
import { positiveId } from "@/lib/validate";

export async function DELETE(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    deleteReport(positiveId(id, "Report"));
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
