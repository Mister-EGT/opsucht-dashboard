import { describe, expect, it } from "vitest";
import { buildAuctionCategoryNavigation } from "@/lib/auction-categories";
import type { AuctionCategory } from "@/lib/schemas";

function category(name: string, displayName: string, parentCategory?: string): AuctionCategory {
  return { name, displayName, parentCategory, matchTypes: [] };
}

describe("Auktionskategorienavigation", () => {
  it("gruppiert Unterkategorien unter dem von der API gelieferten Elternknoten", () => {
    const navigation = buildAuctionCategoryNavigation([
      category("sub_tools", "Werkzeuge", "parent_tools_combat"),
      category("custom_items", "Custom Items"),
      category("parent_tools_combat", "Werkzeuge & Kampf"),
      category("sub_combat", "Kampf", "parent_tools_combat"),
    ]);

    expect(navigation.groups).toHaveLength(1);
    expect(navigation.groups[0]?.parent.name).toBe("parent_tools_combat");
    expect(navigation.groups[0]?.children.map((item) => item.displayName)).toEqual(["Kampf", "Werkzeuge"]);
    expect(navigation.standalone.map((item) => item.name)).toEqual(["custom_items"]);
  });

  it("verliert Kategorien mit unbekanntem Elternknoten nicht", () => {
    const navigation = buildAuctionCategoryNavigation([
      category("orphan", "Unbekannte Unterkategorie", "missing_parent"),
    ]);

    expect(navigation.groups).toEqual([]);
    expect(navigation.standalone.map((item) => item.name)).toEqual(["orphan"]);
  });
});
