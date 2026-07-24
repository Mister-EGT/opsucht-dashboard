import { describe, expect, it } from "vitest";
import {
  auctionFilterHref,
  marketFilterHref,
  merchantFilterHref,
  parseAuctionFilters,
  parseMarketFilters,
  parseMerchantQuery,
} from "@/lib/filter-url";

describe("URL-gebundene Filter", () => {
  it("liest und serialisiert Marktfilter verlustfrei", () => {
    const parsed = parseMarketFilters("q=Diamond+Block&category=Bergbau&filter=tradable&view=compact");
    expect(parsed).toEqual({
      query: "Diamond Block",
      category: "Bergbau",
      availability: "tradable",
      density: "compact",
    });
    expect(parseMarketFilters(marketFilterHref(parsed).split("?")[1] ?? "")).toEqual(parsed);
  });

  it("fällt bei unbekannten Marktwerten auf sichere Standardwerte zurück", () => {
    expect(parseMarketFilters("filter=unknown&view=unknown")).toMatchObject({
      availability: "all",
      density: "detailed",
    });
  });

  it("erhält alle Auktionsfilter einschließlich Kartenansicht, Bald-Filter und Seite", () => {
    const parsed = parseAuctionFilters("q=Helm&category=custom_items&min=10%2C5&max=500&soon=1&view=cards&page=4");
    expect(parsed).toEqual({
      query: "Helm",
      category: "custom_items",
      minimum: "10,5",
      maximum: "500",
      soon: true,
      view: "cards",
      page: 4,
    });
    expect(parseAuctionFilters(auctionFilterHref(parsed).split("?")[1] ?? "")).toEqual(parsed);
  });

  it("fällt bei einer ungültigen Auktionsseite sicher auf Seite 1 zurück", () => {
    expect(parseAuctionFilters("page=0").page).toBe(1);
    expect(parseAuctionFilters("page=unbekannt").page).toBe(1);
  });

  it("kodiert Händler-Suchbegriffe für direkte und nachträgliche Navigation", () => {
    const href = merchantFilterHref("Holzbündel & Stein");
    expect(href).toBe("/merchant?q=Holzb%C3%BCndel+%26+Stein");
    expect(parseMerchantQuery(href.split("?")[1] ?? "")).toBe("Holzbündel & Stein");
  });
});
