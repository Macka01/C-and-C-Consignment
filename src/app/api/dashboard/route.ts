import { getDashboard } from "@/lib/data";
import { fail, json, live } from "@/lib/handlers";

export async function GET() {
  try {
    await live();
    return json(getDashboard());
  } catch (error) {
    return fail(error);
  }
}
