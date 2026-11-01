import { describe, expect, it } from "vitest";
import { parsePriceInput } from "@/lib/price-input";

describe("parsePriceInput", () => {
  it("liefert null für leere oder ungültige Eingaben", () => {
    for (const value of ["", "   ", "abc", "-5", "1e3", "1,2,3", "1.2.3", "1,000,000"]) {
      expect(parsePriceInput(value)).toBeNull();
    }
  });

  it("liest ganze Zahlen und Dezimalwerte", () => {
    expect(parsePriceInput("12")).toBe(12);
    expect(parsePriceInput("1,5")).toBe(1.5);
    expect(parsePriceInput("0.25")).toBe(0.25);
  });

  it("liest deutsche Tausenderpunkte", () => {
    expect(parsePriceInput("1.000")).toBe(1000);
    expect(parsePriceInput("1.000.000")).toBe(1_000_000);
    expect(parsePriceInput("1.000,50")).toBe(1000.5);
  });

  it("liest englische Schreibweise mit Komma als Tausendertrenner", () => {
    expect(parsePriceInput("1,000.50")).toBe(1000.5);
  });

  it("ignoriert Leerzeichen", () => {
    expect(parsePriceInput("1 000")).toBe(1000);
  });
});
