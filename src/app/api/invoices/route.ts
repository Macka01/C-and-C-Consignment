import { createInvoice, listInvoices } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseInvoice } from "@/lib/parse";
import { queryId } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    const url = new URL(request.url);
    return json(listInvoices(queryId(url, "storeId")));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    return json(createInvoice(parseInvoice(await readJson(request))), 201);
  } catch (error) {
    return fail(error);
  }
}
