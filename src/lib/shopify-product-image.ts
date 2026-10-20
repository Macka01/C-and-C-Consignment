import { createHash } from "node:crypto";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SHOPIFY_THUMB_IMAGE_WIDTH = 480;
export const SHOPIFY_SHOWCASE_IMAGE_WIDTH = 2048;

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

export function localProductImageName(
  productId: number,
  shopifyUrl: string,
  ext: string,
  kind: "thumb" | "gallery" = "thumb",
) {
  const hash = createHash("sha1").update(shopifyUrl).digest("hex").slice(0, 10);
  return kind === "gallery" ? `${productId}-${hash}-lg.${ext}` : `${productId}-${hash}.${ext}`;
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

const SHOPIFY_SIZE_SUFFIX = /_(?:pico|icon|thumb|small|compact|medium|large|grande|master|\d+x\d+)(?=\.[a-z0-9]+$)/i;

function parseShopifyCdnUrl(url: string) {
  const remote = url.trim();
  if (!remote) return null;
  try {
    const parsed = new URL(remote);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stripShopifySize(parsed: URL) {
  parsed.pathname = parsed.pathname.replace(SHOPIFY_SIZE_SUFFIX, "");
  parsed.searchParams.delete("width");
  parsed.searchParams.delete("height");
  parsed.searchParams.delete("crop");
  return parsed;
}

/** Same photo with or without a width/height query or `_480x480` filename. */
export function shopifyImageIdentity(url: string) {
  const parsed = parseShopifyCdnUrl(url);
  if (!parsed) return url.trim();
  return stripShopifySize(parsed).toString();
}

export function collectShopifyImageUrls(urls: Array<string | null | undefined>) {
  const collected: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url) continue;
    const identity = shopifyImageIdentity(url);
    if (seen.has(identity)) continue;
    seen.add(identity);
    collected.push(url);
  }
  return collected;
}

/** A listing thumbnail. Shopify’s CDN serves this size from the original photo URL. */
export function shopifySizedImageUrl(url: string, width = SHOPIFY_THUMB_IMAGE_WIDTH) {
  const parsed = parseShopifyCdnUrl(url);
  if (!parsed) return "";
  if (parsed.searchParams.has("width")) return parsed.toString();
  parsed.searchParams.set("width", String(width));
  return parsed.toString();
}

/** Fullscreen / iPad showcase. Asks Shopify for 2048px from the original, never the 480px thumb. */
export function shopifyMasterImageUrl(url: string, width = SHOPIFY_SHOWCASE_IMAGE_WIDTH) {
  const parsed = parseShopifyCdnUrl(url);
  if (!parsed) return "";
  stripShopifySize(parsed);
  parsed.searchParams.set("width", String(width));
  return parsed.toString();
}

export function isShowcaseImageFile(storedName: string | null | undefined) {
  return Boolean(storedName && /-lg\./i.test(storedName));
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
