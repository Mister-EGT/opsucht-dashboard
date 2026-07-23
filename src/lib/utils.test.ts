import { describe, expect, it } from "vitest";
import { escapeCsv, safeDecodeURIComponent } from "@/lib/utils";

describe("sichere URL-Dekodierung", () => {
  it("dekodiert gültige Werte", () => {
    expect(safeDecodeURIComponent("minecraft%3Adiamond_block")).toBe("minecraft:diamond_block");
  });

  it("lässt unvollständige Escape-Sequenzen unverändert statt zu werfen", () => {
    expect(safeDecodeURIComponent("DIAMOND%2")).toBe("DIAMOND%2");
  });
});

describe("CSV-Export", () => {
  it("maskiert potenzielle Tabellenformeln aus fremden Textdaten", () => {
    expect(escapeCsv("=HYPERLINK(\"https://example.com\")")).toBe("\"'=HYPERLINK(\"\"https://example.com\"\")\"");
    expect(escapeCsv("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(escapeCsv(-12.5)).toBe("-12.5");
  });
});
