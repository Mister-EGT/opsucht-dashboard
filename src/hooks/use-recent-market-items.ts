"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addRecentMarketItem,
  normalizeRecentMarketItems,
  RECENT_MARKET_ITEMS_EVENT,
  RECENT_MARKET_ITEMS_KEY,
  type RecentMarketItem,
} from "@/lib/recent-items";

function readRecentItems(): RecentMarketItem[] {
  try {
    return normalizeRecentMarketItems(JSON.parse(localStorage.getItem(RECENT_MARKET_ITEMS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function persistRecentItems(items: RecentMarketItem[]): void {
  try {
    localStorage.setItem(RECENT_MARKET_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // The current component state remains usable if storage is blocked or full.
  }
  window.dispatchEvent(new CustomEvent(RECENT_MARKET_ITEMS_EVENT, { detail: items }));
}

export function useRecentMarketItems() {
  const [items, setItems] = useState<RecentMarketItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const update = () => {
      setItems(readRecentItems());
      setHydrated(true);
    };
    const updateFromEvent = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      setItems(normalizeRecentMarketItems(detail ?? readRecentItems()));
      setHydrated(true);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener(RECENT_MARKET_ITEMS_EVENT, updateFromEvent);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(RECENT_MARKET_ITEMS_EVENT, updateFromEvent);
    };
  }, []);

  const remember = useCallback((item: Omit<RecentMarketItem, "viewedAt">) => {
    const next = addRecentMarketItem(readRecentItems(), { ...item, viewedAt: new Date().toISOString() });
    setItems(next);
    persistRecentItems(next);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    persistRecentItems([]);
  }, []);

  return { items, hydrated, remember, clear };
}
