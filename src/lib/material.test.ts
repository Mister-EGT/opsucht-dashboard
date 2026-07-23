import { describe, expect, it } from "vitest";
import { normalizeMaterialKey, normalizeMaterialList } from "@/lib/material";

describe("Materialnormalisierung", () => {
  it("vereinheitlicht Namespace, Leerzeichen und Großschreibung", () => {
    expect(normalizeMaterialKey(" minecraft:acacia_leaves ")).toBe("ACACIA_LEAVES");
  });

  it("entfernt Duplikate, ungültige Werte und begrenzt die Liste", () => {
    expect(normalizeMaterialList(["stone", "minecraft:STONE", null, "dirt", "sand"], 2)).toEqual(["STONE", "DIRT"]);
  });
});
