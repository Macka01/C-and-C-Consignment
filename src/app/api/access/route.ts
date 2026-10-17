import { NextResponse } from "next/server";
import { accessCookieName, accessCookieValue, accessRequired, codeMatches } from "@/lib/access";
import { fail, live, readJson } from "@/lib/handlers";
import { HttpError } from "@/lib/errors";

function payload(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    await live();
    return payload({ required: accessRequired() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await live();
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    if (!accessRequired()) {
      return payload({ ok: true, required: false });
    }
    if (!(await codeMatches(code))) {
      throw new HttpError("That access code is not right.", 401);
    }
    const token = await accessCookieValue();
    const response = payload({ ok: true, required: true });
    response.cookies.set(accessCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    await live();
    const response = payload({ ok: true });
    response.cookies.set(accessCookieName(), "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return fail(error);
  }
}
