import { getDb } from "@/lib/db";
import { fail, json, live } from "@/lib/handlers";

export async function GET() {
  try {
    await live();
    getDb().prepare("SELECT 1 AS ok").get();
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
