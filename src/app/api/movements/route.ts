import { listMovements, recordMovement } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseMovement } from "@/lib/parse";
import { queryId } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await live();
    const url = new URL(request.url);
    return json(
      listMovements({
        storeId: queryId(url, "storeId") ?? undefined,
        productId: queryId(url, "productId") ?? undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    return json(recordMovement(parseMovement(await readJson(request))), 201);
  } catch (error) {
    return fail(error);
  }
}
