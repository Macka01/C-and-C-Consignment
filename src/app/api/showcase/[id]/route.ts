import { getShowcase } from "@/lib/data";
import { HttpError } from "@/lib/errors";
import { fail, json, live, type IdContext } from "@/lib/handlers";
import { positiveId } from "@/lib/validate";

export async function GET(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    const showcase = getShowcase(positiveId(id, "Product"));
    if (!showcase) throw new HttpError("That piece is no longer in the Cotton & Clay catalog.", 404);
    return json(showcase);
  } catch (error) {
    return fail(error);
  }
}
