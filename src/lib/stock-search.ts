import type { StockLine } from "./types";

export function matchesStockSearch(
  line: Pick<StockLine, "productName" | "productGroup" | "description" | "consigneeCode">,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [line.productName, line.productGroup, line.description, line.consigneeCode].some((value) =>
    value.toLowerCase().includes(needle),
  );
}
