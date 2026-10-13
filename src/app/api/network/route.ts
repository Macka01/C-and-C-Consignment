import { getNetwork } from "@/lib/data";
import { fail, json, live } from "@/lib/handlers";

export async function GET() {
  try {
    await live();
    return json(getNetwork());
  } catch (error) {
    return fail(error);
  }
}
