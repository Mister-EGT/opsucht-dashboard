import { describe, expect, it } from "vitest";
import { resolveAuctionItemIcon } from "@/lib/auction-item-icons";

describe("Auktions-Itembilder", () => {
  it("ordnet bekannte Custom-Items anhand ihres Anzeigenamens zu", () => {
    expect(resolveAuctionItemIcon({
      material: "GOLDEN_HORSE_ARMOR",
      displayName: "Thanos Handschuh",
    })).toBe("https://i.postimg.cc/PJ2P1ZkS/Thanos-handschuh.png");
  });

  it("ignoriert Minecraft-Farbcodes und überflüssige Leerzeichen", () => {
    expect(resolveAuctionItemIcon({
      material: "NETHERITE_AXE",
      displayName: "  §6Shard Timber Axt  ",
    })).toBe("https://i.postimg.cc/Wpx74rp4/Shard-Timber-Axt.png");
  });

  it("berücksichtigt materialabhängige Custom-Item-Varianten", () => {
    expect(resolveAuctionItemIcon({
      material: "LEATHER_BOOTS",
      displayName: "H4CKER.exe",
    })).toBe("https://i.postimg.cc/rmSJ2qB0/Hacker-schuhe.png");
  });

  it("behält vorhandene API-Icons bei unbekannten Items bei", () => {
    expect(resolveAuctionItemIcon({
      material: "BOW",
      displayName: "Unbekannter Bogen",
      icon: "https://img.mc-api.io/bow.png",
    })).toBe("https://img.mc-api.io/bow.png");
  });

  it("verwendet für Sammelkarten das gemeinsame Kartenbild", () => {
    expect(resolveAuctionItemIcon({
      material: "PAPER",
      displayName: "Christian am Strand",
      lore: ["Sammle diese Sammelkarte", "in deinem /Album."],
    })).toBe("https://i.postimg.cc/v8gy5LQM/Booster.png");
  });

  it("fällt bei nicht zugeordneten Items auf das Materialbild zurück", () => {
    expect(resolveAuctionItemIcon({
      material: "NETHERITE_PICKAXE",
      displayName: "Höllenspitzhacke",
    })).toBe("https://img.mc-api.io/netherite_pickaxe.png");
  });
});
