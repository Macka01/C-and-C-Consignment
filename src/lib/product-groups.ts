export function compareProductGroup(left: string, right: string) {
  const a = left.trim();
  const b = right.trim();
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

export function groupByProductGroup<T extends { productGroup: string }>(
  items: T[],
): Array<{ group: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = item.productGroup.trim();
    const list = groups.get(group) ?? [];
    list.push(item);
    groups.set(group, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareProductGroup(left, right))
    .map(([group, grouped]) => ({ group, items: grouped }));
}
