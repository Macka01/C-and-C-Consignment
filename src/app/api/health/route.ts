import { json } from "@/lib/handlers";

export async function GET() {
  return json({ ok: true });
}
