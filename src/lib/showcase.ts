import { normalizeShopifyName, stripShopifyDefaultTitle } from "@/lib/shopify-match";

export type ShowcaseCatalogRow = {
  id: number;
  productGroup: string;
  name: string;
  description: string;
  retailPrice: number;
  imageUrl: string | null;
  photos?: Array<{ url: string; identity: string }>;
};

export type ShowcasePhoto = {
  productId: number;
  url: string;
  alt: string;
};

export type ShowcaseVariant = {
  id: number;
  catalogName: string;
  label: string;
  price: number;
  imageUrl: string | null;
};

export type ProductShowcase = {
  id: number;
  title: string;
  productGroup: string;
  description: string;
  photos: ShowcasePhoto[];
  variants: ShowcaseVariant[];
  path: string;
};

const VARIANT_SPLIT = /\s+[—–-]\s+/;

export function showcaseParentName(catalogName: string) {
  const cleaned = stripShopifyDefaultTitle(catalogName);
  const parts = cleaned.split(VARIANT_SPLIT);
  if (parts.length < 2) return cleaned;
  return parts[0]?.trim() || cleaned;
}

export function showcaseVariantLabel(catalogName: string) {
  const cleaned = stripShopifyDefaultTitle(catalogName);
  const parts = cleaned.split(VARIANT_SPLIT);
  if (parts.length < 2) return "";
  return parts.slice(1).join(" — ").trim();
}

export function sameShowcaseFamily(left: ShowcaseCatalogRow, right: ShowcaseCatalogRow) {
  if (normalizeShopifyName(left.productGroup) !== normalizeShopifyName(right.productGroup)) return false;
  return normalizeShopifyName(showcaseParentName(left.name)) === normalizeShopifyName(showcaseParentName(right.name));
}

function variantSortLabel(row: ShowcaseCatalogRow) {
  return showcaseVariantLabel(row.name) || row.name;
}

export function buildShowcase(productId: number, catalog: ShowcaseCatalogRow[]): ProductShowcase | null {
  const opened = catalog.find((row) => row.id === productId);
  if (!opened) return null;
  const family = catalog
    .filter((row) => sameShowcaseFamily(opened, row))
    .sort((left, right) => {
      const byLabel = variantSortLabel(left).localeCompare(variantSortLabel(right), "en", { sensitivity: "base" });
      return byLabel || left.id - right.id;
    });
  const canonical = family.reduce((lowest, row) => (row.id < lowest.id ? row : lowest), family[0]!);
  const title = showcaseParentName(opened.name);
  const description = family.map((row) => row.description.trim()).find(Boolean) || opened.description;
  const variants: ShowcaseVariant[] = family.map((row) => {
    const label = showcaseVariantLabel(row.name);
    return {
      id: row.id,
      catalogName: row.name,
      label: label || (family.length === 1 ? "Standard" : row.name),
      price: row.retailPrice,
      imageUrl: row.imageUrl,
    };
  });
  const photos: ShowcasePhoto[] = [];
  const seen = new Set<string>();
  const ordered = [opened, ...family.filter((row) => row.id !== opened.id)];
  for (const row of ordered) {
    const files = row.photos?.length
      ? row.photos
      : row.imageUrl
        ? [{ url: row.imageUrl, identity: row.imageUrl }]
        : [];
    const label = showcaseVariantLabel(row.name);
    for (const file of files) {
      const key = file.identity || file.url;
      if (!file.url || seen.has(key) || seen.has(file.url)) continue;
      seen.add(key);
      seen.add(file.url);
      photos.push({
        productId: row.id,
        url: file.url,
        alt: `${title}${label ? ` — ${label}` : ""}`,
      });
    }
  }
  return {
    id: canonical.id,
    title,
    productGroup: opened.productGroup,
    description,
    photos,
    variants,
    path: `/showcase/${canonical.id}`,
  };
}
