import { normalizeMaterialKey } from "@/lib/material";

export const RECENT_MARKET_ITEMS_KEY = "opsucht-recent-market-items-v1";
export const RECENT_MARKET_ITEMS_EVENT = "opsucht:recent-market-items";
export const RECENT_MARKET_ITEMS_LIMIT = 8;

export interface RecentMarketItem {
  material: string;
  name: string;
  category: string | null;
  icon: string | null;
  viewedAt: string;
}

export function normalizeRecentMarketItems(value: unknown): RecentMarketItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: RecentMarketItem[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<RecentMarketItem>;
    if (typeof candidate.material !== "string" || typeof candidate.name !== "string" || typeof candidate.viewedAt !== "string") continue;
    const material = normalizeMaterialKey(candidate.material);
    const viewedAt = new Date(candidate.viewedAt);
    if (!material || !candidate.name.trim() || Number.isNaN(viewedAt.getTime()) || seen.has(material)) continue;
    seen.add(material);
    items.push({
      material,
      name: candidate.name.trim(),
      category: typeof candidate.category === "string" && candidate.category.trim() ? candidate.category.trim() : null,
      icon: typeof candidate.icon === "string" && candidate.icon.trim() ? candidate.icon : null,
      viewedAt: viewedAt.toISOString(),
    });
    if (items.length >= RECENT_MARKET_ITEMS_LIMIT) break;
  }

  return items;
}

export function addRecentMarketItem(current: RecentMarketItem[], item: RecentMarketItem): RecentMarketItem[] {
  return normalizeRecentMarketItems([item, ...current.filter((entry) => normalizeMaterialKey(entry.material) !== normalizeMaterialKey(item.material))]);
}
