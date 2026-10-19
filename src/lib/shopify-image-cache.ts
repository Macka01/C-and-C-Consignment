import fs from "node:fs";
import { getProductImageRecord, productImagePath, saveProductImage } from "@/lib/data";
import {
  downloadShopifyImage,
  localProductImageName,
  shouldFetchProductImage,
} from "@/lib/shopify-product-image";

const DOWNLOAD_CONCURRENCY = 4;

export type ProductImageJob = { productId: number; url: string };

export function uniqueProductImageJobs(jobs: ProductImageJob[]) {
  const map = new Map<number, string>();
  for (const job of jobs) {
    const url = job.url.trim();
    if (!url) continue;
    map.set(job.productId, url);
  }
  return [...map.entries()].map(([productId, url]) => ({ productId, url }));
}

async function cacheOneImage(job: ProductImageJob) {
  const stored = getProductImageRecord(job.productId);
  if (!stored) return;
  const exists = Boolean(stored.imageName && fs.existsSync(productImagePath(stored.imageName)));
  if (!shouldFetchProductImage(stored.shopifyUrl, stored.imageName, exists, job.url)) return;
  const downloaded = await downloadShopifyImage(job.url);
  if (!downloaded) return;
  const storedName = localProductImageName(job.productId, job.url, downloaded.ext);
  fs.writeFileSync(productImagePath(storedName), downloaded.bytes);
  saveProductImage(job.productId, job.url, storedName, downloaded.mime);
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
