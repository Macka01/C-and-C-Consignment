import { connection } from "next/server";
import { HttpError } from "@/lib/errors";
import { asRecord } from "@/lib/validate";

export async function live() {
  await connection();
}

export type IdContext = { params: Promise<{ id: string }> };

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  console.error(error);
  return json({ error: "Something went wrong on the server. Try again." }, 500);
}

export async function readJson(request: Request) {
  try {
    return asRecord(await request.json());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("The form could not be read. Try again.", 400);
  }
}
