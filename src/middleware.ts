import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessCookieName, accessCookieValue, accessRequired, isOpenPath, sameSecret } from "@/lib/access";

export async function middleware(request: NextRequest) {
  if (!accessRequired()) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();

  const expected = await accessCookieValue();
  const got = request.cookies.get(accessCookieName())?.value ?? "";
  if (expected && got && sameSecret(got, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the access code." }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
