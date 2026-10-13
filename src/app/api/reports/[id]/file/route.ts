import { readReportFile } from "@/lib/data";
import { fail, live, type IdContext } from "@/lib/handlers";
import { positiveId } from "@/lib/validate";

export async function GET(_request: Request, ctx: IdContext) {
  try {
    await live();
    const { id } = await ctx.params;
    const file = readReportFile(positiveId(id, "Report"));
    const filename = file.originalName.replace(/["\r\n]/g, "");
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
