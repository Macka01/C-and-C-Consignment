const COOKIE = "cc_access";
const HMAC_KEY = "cotton-clay-access-v1";

export function accessCode() {
  return (process.env.CONSIGNMENT_ACCESS_CODE ?? "").trim();
}

export function accessRequired() {
  return Boolean(accessCode());
}

export function accessCookieName() {
  return COOKIE;
}

export function isOpenPath(pathname: string) {
  if (pathname === "/login" || pathname === "/manifest.webmanifest" || pathname === "/favicon.ico") {
    return true;
  }
  if (pathname === "/api/health" || pathname === "/api/access") return true;
  if (pathname.startsWith("/showcase")) return true;
  if (pathname.startsWith("/api/showcase/")) return true;
  if (/^\/api\/products\/\d+\/image$/.test(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/icon-") || pathname === "/apple-touch-icon.png") return true;
  return /\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest)$/i.test(pathname);
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return hex(signed);
}

export async function accessCookieValue() {
  const code = accessCode();
  if (!code) return "";
  return hmac(code);
}

export function sameSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function codeMatches(input: string) {
  const expected = accessCode();
  if (!expected) return true;
  return sameSecret(await hmac(input.trim()), await hmac(expected));
}
