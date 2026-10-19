import { createHash } from "node:crypto";

export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Download only when Shopify’s photo URL is new, or the local file is missing. */
export function shouldFetchProductImage(
  storedShopifyUrl: string | null | undefined,
  storedName: string | null | undefined,
  fileExists: boolean,
  remoteUrl: string | null | undefined,
) {
  const remote = remoteUrl?.trim() ?? "";
  if (!remote) return false;
  if (storedShopifyUrl === remote && storedName && fileExists) return false;
  return true;
}

export function localProductImageName(productId: number, shopifyUrl: string, ext: string) {
  const hash = createHash("sha1").update(shopifyUrl).digest("hex").slice(0, 10);
  return `${productId}-${hash}.${ext}`;
}

export function extensionForImageMime(mime: string, fallbackUrl: string) {
  const fromMime = mimeExtensions[mime.toLowerCase().split(";")[0]?.trim() ?? ""];
  if (fromMime) return fromMime;
  const fromUrl = fallbackUrl.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (fromUrl && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromUrl)) {
    return fromUrl === "jpeg" ? "jpg" : fromUrl;
  }
  return "jpg";
}

export function publicProductImageUrl(productId: number, storedName: string) {
  return `/api/products/${productId}/image?v=${encodeURIComponent(storedName)}`;
}

/** A listing thumbnail. Shopify’s CDN serves this size from the original photo URL. */
export function shopifySizedImageUrl(url: string, width = 480) {
  const remote = url.trim();
  if (!remote) return "";
  let parsed: URL;
  try {
    parsed = new URL(remote);
  } catch {
    return "";
  }
  if (!/^https?:$/i.test(parsed.protocol)) return "";
  if (parsed.searchParams.has("width")) return parsed.toString();
  parsed.searchParams.set("width", String(width));
  return parsed.toString();
}

export async function downloadShopifyImage(
  url: string,
): Promise<{ bytes: Buffer; mime: string; ext: string } | null> {
  const remote = url.trim();
  if (!/^https?:\/\//i.test(remote)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(remote, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) return null;
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > PRODUCT_IMAGE_MAX_BYTES) return null;
    return { bytes: buffer, mime, ext: extensionForImageMime(mime, remote) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
