export function normalizeMaterialKey(value: string): string {
  return value.trim().replace(/^minecraft:/i, "").toUpperCase();
}

export function normalizeMaterialList(values: unknown, limit = 500): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeMaterialKey(value);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= limit) break;
  }
  return [...unique];
}
