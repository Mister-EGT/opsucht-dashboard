import { describe, expect, it } from "vitest";
import { addRecentMarketItem, normalizeRecentMarketItems } from "@/lib/recent-items";

describe("zuletzt angesehene Marktitems", () => {
  it("bereinigt beschädigte Einträge und dedupliziert Materialien", () => {
    const result = normalizeRecentMarketItems([
      { material: "stone", name: "Stein", category: "Blöcke", icon: null, viewedAt: "2026-07-21T08:00:00.000Z" },
      { material: "minecraft:STONE", name: "Doppelter Stein", viewedAt: "2026-07-21T07:00:00.000Z" },
      { material: "DIRT", name: "", viewedAt: "ungültig" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.material).toBe("STONE");
  });

  it("verschiebt ein erneut angesehenes Item nach vorn", () => {
    const current = normalizeRecentMarketItems([
      { material: "STONE", name: "Stein", viewedAt: "2026-07-21T07:00:00.000Z" },
      { material: "DIRT", name: "Erde", viewedAt: "2026-07-21T06:00:00.000Z" },
    ]);
    const result = addRecentMarketItem(current, { material: "dirt", name: "Erde", category: null, icon: null, viewedAt: "2026-07-21T09:00:00.000Z" });
    expect(result.map((item) => item.material)).toEqual(["DIRT", "STONE"]);
  });
});
