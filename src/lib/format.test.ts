import { describe, expect, it } from "vitest";
import { formatEconomyValue, formatExactPrice, formatMaterialName, formatPrice, formatSignedPercentNumber, parseOpsuchtDate } from "@/lib/format";

describe("deutsche Formatierung und OPSUCHT-Zeitstempel", () => {
  it("interpretiert zeitzonenlose API-Verläufe ausdrücklich als Europe/Berlin", () => {
    expect(parseOpsuchtDate("2026-07-06T19:00:00").toISOString()).toBe("2026-07-06T17:00:00.000Z");
    expect(parseOpsuchtDate("2026-01-21T01:00:00").toISOString()).toBe("2026-01-21T00:00:00.000Z");
  });

  it("behält ISO-Zeitstempel mit Offset unverändert", () => {
    expect(parseOpsuchtDate("2026-07-19T05:59:44.548Z").toISOString()).toBe("2026-07-19T05:59:44.548Z");
  });

  it("verwirft unbekannte Zeitstempelformate eindeutig", () => {
    expect(Number.isNaN(parseOpsuchtDate("kein-zeitstempel").getTime())).toBe(true);
  });

  it("formatiert technische Materialnamen lesbar", () => {
    expect(formatMaterialName("minecraft:DIAMOND_BLOCK")).toBe("Diamond Block");
    expect(formatEconomyValue(Number.NaN)).toBe("Nicht verfügbar");
  });

  it("setzt bei fehlenden Prozentwerten kein positives Vorzeichen vor den Leerwert", () => {
    expect(formatSignedPercentNumber(null)).toBe("Nicht verfügbar");
    expect(formatSignedPercentNumber(2.5)).toBe("+2,5 %");
    expect(formatSignedPercentNumber(-2.5)).toBe("-2,5 %");
  });

  it("kennzeichnet ausschließlich gültige Geldpreise mit dem Dollarzeichen", () => {
    expect(formatPrice(1234.5)).toBe("1.234,5 $");
    expect(formatPrice(1_250_000)).toBe("1,3\u00a0Mio. $");
    expect(formatPrice(0.1255)).toBe("0,1255 $");
    expect(formatPrice(0.0000125)).toBe("0,0000125 $");
    expect(formatPrice(null)).toBe("Nicht verfügbar");
    expect(formatPrice(Number.NaN)).toBe("Nicht verfügbar");
  });

  it("stellt gekürzte Geldpreise bei Bedarf vollständig dar", () => {
    expect(formatExactPrice(1_250_000.125)).toBe("1.250.000,125 $");
    expect(formatExactPrice(undefined)).toBe("Nicht verfügbar");
  });
});
