import fs from "node:fs";
import {
  getProductImageRecord,
  getProductPhotoByIdentity,
  productImagePath,
  saveProductImage,
  saveProductPhoto,
} from "@/lib/data";
import {
  downloadShopifyImage,
  isShowcaseImageFile,
  localProductImageName,
  shopifyImageIdentity,
  shopifyMasterImageUrl,
  shopifySizedImageUrl,
  shouldFetchProductImage,
} from "@/lib/shopify-product-image";

const DOWNLOAD_CONCURRENCY = 4;

export type ProductImageJob = { productId: number; url: string; kind?: "thumb" | "gallery" };

export function uniqueProductImageJobs(jobs: ProductImageJob[]) {
  const seen = new Set<string>();
  const unique: ProductImageJob[] = [];
  for (const job of jobs) {
    const url = job.url.trim();
    if (!url) continue;
    const kind = job.kind ?? "thumb";
    const key = `${job.productId}|${kind}|${shopifyImageIdentity(url)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ productId: job.productId, url, kind });
  }
  return unique;
}

async function downloadNamed(url: string, sized: string) {
  let downloaded = sized && sized !== url ? await downloadShopifyImage(sized) : null;
  if (!downloaded) downloaded = await downloadShopifyImage(url);
  return downloaded;
}

async function cacheGalleryImage(job: ProductImageJob) {
  const identity = shopifyImageIdentity(job.url);
  if (!identity) return;
  const existing = getProductPhotoByIdentity(job.productId, identity);
  const exists = Boolean(existing?.storedName && fs.existsSync(productImagePath(existing.storedName)));
  if (exists && isShowcaseImageFile(existing?.storedName)) return;
  const original = job.url.trim();
  const downloaded = await downloadNamed(original, shopifyMasterImageUrl(original));
  if (!downloaded) return;
  const storedName = localProductImageName(job.productId, `${identity}|lg`, downloaded.ext, "gallery");
  fs.writeFileSync(productImagePath(storedName), downloaded.bytes);
  saveProductPhoto(job.productId, identity, storedName, downloaded.mime);
}

async function cacheThumbImage(job: ProductImageJob) {
  const stored = getProductImageRecord(job.productId);
  if (!stored) return;
  const exists = Boolean(stored.imageName && fs.existsSync(productImagePath(stored.imageName)));
  if (!shouldFetchProductImage(stored.shopifyUrl, stored.imageName, exists, job.url)) return;
  const original = job.url.trim();
  const downloaded = await downloadNamed(original, shopifySizedImageUrl(original));
  if (!downloaded) return;
  const storedName = localProductImageName(job.productId, job.url, downloaded.ext);
  fs.writeFileSync(productImagePath(storedName), downloaded.bytes);
  saveProductImage(job.productId, job.url, storedName, downloaded.mime);
}

async function cacheOneImage(job: ProductImageJob) {
  if (job.kind === "gallery") {
    await cacheGalleryImage(job);
    return;
  }
  await cacheThumbImage(job);
}

export async function cacheShopifyProductImages(jobs: ProductImageJob[]) {
  const unique = uniqueProductImageJobs(jobs);
  const queue = [...unique];
  const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, queue.length) || 0 }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (!job) return;
      await cacheOneImage(job);
    }
  });
  await Promise.all(workers);
}
