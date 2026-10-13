import { createStore, listStores } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseStore } from "@/lib/parse";

export async function GET() {
  try {
    await live();
    return json(listStores());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    const store = createStore(parseStore(await readJson(request)));
    return json(store, 201);
  } catch (error) {
    return fail(error);
  }
}
