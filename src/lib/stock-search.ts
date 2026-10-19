import type { Product, StockLine } from "./types";

function matchesTextSearch(values: Array<string | null | undefined>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(needle));
}

export function matchesStockSearch(
  line: Pick<StockLine, "productName" | "productGroup" | "description" | "consigneeCode">,
  query: string,
) {
  return matchesTextSearch([line.productName, line.productGroup, line.description, line.consigneeCode], query);
}

export function matchesProductSearch(product: Pick<Product, "name" | "productGroup" | "description">, query: string) {
  return matchesTextSearch([product.name, product.productGroup, product.description], query);
}
