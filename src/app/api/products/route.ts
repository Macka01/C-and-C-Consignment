import { createProduct, listProducts } from "@/lib/data";
import { fail, json, live, readJson } from "@/lib/handlers";
import { parseProduct } from "@/lib/parse";

export async function GET() {
  try {
    await live();
    return json(listProducts());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    return json(createProduct(parseProduct(await readJson(request))), 201);
  } catch (error) {
    return fail(error);
  }
}
