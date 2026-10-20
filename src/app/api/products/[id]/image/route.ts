import { readProductImage } from "@/lib/data";
import { fail, live, type IdContext } from "@/lib/handlers";
import { positiveId } from "@/lib/validate";

export async function GET(request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    const storedName = new URL(request.url).searchParams.get("v");
    const file = readProductImage(positiveId(id, "Product"), storedName);
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
