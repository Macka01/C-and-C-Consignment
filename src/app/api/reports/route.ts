import { listReports, saveReport } from "@/lib/data";
import { HttpError } from "@/lib/errors";
import { fail, json, live } from "@/lib/handlers";
import { monthPeriod, optionalText, positiveId, queryId, queryPeriod } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    const url = new URL(request.url);
    return json(listReports({ storeId: queryId(url, "storeId"), period: queryPeriod(url) }));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError("Choose a photo or PDF to save.", 400);
    }
    const notesRaw = form.get("notes");
    const replaceRaw = form.get("replaceId");
    const report = await saveReport({
      storeId: positiveId(form.get("storeId"), "Store"),
      period: monthPeriod(form.get("period")),
      notes: optionalText({ notes: typeof notesRaw === "string" ? notesRaw : "" }, "notes", "Notes", 2000),
      file,
      replaceId: replaceRaw ? positiveId(replaceRaw, "Report") : null,
    });
    return json(report, 201);
  } catch (error) {
    return fail(error);
  }
}
