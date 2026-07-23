import { describe, expect, it } from "vitest";
import { calculateRequiredItems, calculateShardValue, normalizeMerchantRates, normalizeWholeItemQuantity, parseMerchantSource } from "@/lib/merchant";

const customSource = 'minecraft:paper[custom_name={extra: [{bold: 1b, color: "#926428", text: "Holzbündel"}], text: ""},custom_model_data={floats: [625.0f]},item_name={text: "Holzbündel"}]';

describe("Händlerparser und OPShards-Rechner", () => {
  it("extrahiert Material, Anzeigename und Custom Model Data", () => {
    const parsed = parseMerchantSource(customSource);
    expect(parsed.material).toBe("paper");
    expect(parsed.materialKey).toBe("paper#625");
    expect(parsed.customName).toBe("Holzbündel");
    expect(parsed.customModelData).toBe(625);
    expect(parsed.rawSource).toBe(customSource);
  });

  it("normalisiert einfache minecraft:-Namespaces", () => {
    const parsed = parseMerchantSource("minecraft:diamond_block");
    expect(parsed.materialKey).toBe("diamond_block");
    expect(parsed.displayName).toBe("Diamond Block");
  });

  it("unterstützt auch das ältere numerische Custom-Model-Data-Format", () => {
    const parsed = parseMerchantSource('minecraft:paper[custom_name={text: "Alt"},custom_model_data=626]');
    expect(parsed.materialKey).toBe("paper#626");
    expect(parsed.customModelData).toBe(626);
  });

  it("berechnet Abweichung und Prozentwert", () => {
    const [rate] = normalizeMerchantRates([{ source: "diamond_block", target: "opshards", base: 12, exchangeRate: 13.2 }]);
    expect(rate?.deviation).toBeCloseTo(1.2);
    expect(rate?.deviationPercent).toBeCloseTo(10);
  });

  it("rundet benötigte Minecraft-Items immer auf ganze Stück auf", () => {
    expect(calculateShardValue(64, 13.17)).toBeCloseTo(842.88);
    const required = calculateRequiredItems(1000, 13.17);
    expect(required.exact).toBeCloseTo(75.9301, 3);
    expect(required.wholeItems).toBe(76);
  });

  it("liefert bei einem nicht nutzbaren Kurs kein erfundenes Ergebnis", () => {
    expect(calculateRequiredItems(100, 0)).toEqual({ exact: null, wholeItems: null });
  });

  it("normalisiert Itemmengen auf sichere ganze Zahlen", () => {
    expect(normalizeWholeItemQuantity("64.9")).toBe(64);
    expect(normalizeWholeItemQuantity("1e309")).toBe(0);
    expect(normalizeWholeItemQuantity(-5)).toBe(0);
    expect(normalizeWholeItemQuantity(Number.MAX_SAFE_INTEGER + 1000)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
