import { readProductImage } from "@/lib/data";
import { fail, live, type IdContext } from "@/lib/handlers";
import { positiveId } from "@/lib/validate";

export async function GET(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    const file = readProductImage(positiveId(id, "Product"));
    if (!file) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
