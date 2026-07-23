"use client";

import { CopyPlus, Download, Plus, Save, Scale, ShoppingBasket, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PriceValue } from "@/components/price-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { useMarketItems, useMarketPrices, useMerchantRates } from "@/hooks/use-opsucht";
import { formatEconomyValue, formatExactPrice, formatMaterialName, formatPrice } from "@/lib/format";
import { flattenMarketPrices } from "@/lib/market";
import { normalizeMerchantRates, normalizeWholeItemQuantity } from "@/lib/merchant";
import type { CalculatorPosition } from "@/lib/types";
import { createId, downloadTextFile, escapeCsv } from "@/lib/utils";
import { buildCalculatorOptions, calculateCalculatorTotals } from "@/lib/calculator";
import { normalizeMaterialKey } from "@/lib/material";
import { useToast } from "@/components/toast-provider";

const STORAGE_KEY = "opsucht-calculator-v1";

export function ComparisonCalculator() {
  const prices = useMarketPrices();
  const items = useMarketItems();
  const merchants = useMerchantRates();
  const [positions, setPositions] = useState<CalculatorPosition[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const { notify } = useToast();
  const marketRows = useMemo(() => flattenMarketPrices(prices.data?.data ?? {}, items.data?.data ?? []), [prices.data, items.data]);
  const merchantRows = useMemo(() => normalizeMerchantRates(merchants.data?.data ?? []), [merchants.data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed.flatMap((item): CalculatorPosition[] => {
            if (!item || typeof item !== "object") return [];
            const value = item as Partial<CalculatorPosition>;
            if (typeof value.id !== "string" || typeof value.material !== "string" || typeof value.quantity !== "number" || !Number.isFinite(value.quantity)) return [];
            return [{ id: value.id, material: value.material, quantity: normalizeWholeItemQuantity(value.quantity) }];
          }).filter((position, index, all) => all.findIndex((candidate) => candidate.id === position.id) === index).slice(0, 100);
          setPositions(normalized);
        }
      } catch {
        setPositions([]);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
      // The calculator remains usable in memory if persistent storage is unavailable.
    }
  }, [positions, hydrated]);

  const options = useMemo(() => buildCalculatorOptions(marketRows, merchantRows), [marketRows, merchantRows]);

  const calculated = positions.map((position) => {
    const materialKey = normalizeMaterialKey(position.material);
    const market = marketRows.find((row) => normalizeMaterialKey(row.material) === materialKey);
    const merchant = merchantRows.find((rate) => normalizeMaterialKey(rate.materialKey) === materialKey || normalizeMaterialKey(rate.material) === materialKey);
    const quantity = normalizeWholeItemQuantity(position.quantity);
    return {
      ...position,
      quantity,
      name: market?.name ?? merchant?.displayName ?? formatMaterialName(position.material),
      icon: market?.icon,
      marketBuy: market?.buyPrice === null || market?.buyPrice === undefined ? null : market.buyPrice * quantity,
      marketSell: market?.sellPrice === null || market?.sellPrice === undefined ? null : market.sellPrice * quantity,
      merchantValue: merchant ? merchant.exchangeRate * quantity : null,
      market,
      merchant,
    };
  });

  const totals = calculateCalculatorTotals(calculated);
  const missingBuy = calculated.length - totals.availableBuy;
  const missingSell = calculated.length - totals.availableSell;
  const missingMerchant = calculated.length - totals.availableMerchant;

  const addPosition = () => {
    const first = options[0];
    if (!first) return;
    setPositions((current) => [...current, { id: createId("position"), material: first.key, quantity: 1 }]);
  };
  const updatePosition = (id: string, patch: Partial<CalculatorPosition>) => setPositions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removePosition = (id: string) => setPositions((current) => current.filter((item) => item.id !== id));
  const duplicatePosition = (position: CalculatorPosition) => setPositions((current) => {
    const index = current.findIndex((item) => item.id === position.id);
    const duplicate = { ...position, id: createId("position") };
    return index < 0 ? [...current, duplicate] : [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
  });

  const exportJson = () => {
    downloadTextFile("opsucht-vergleich.json", JSON.stringify({ exportedAt: new Date().toISOString(), positions: calculated.map(({ id, material, quantity, name, marketBuy, marketSell, merchantValue }) => ({ id, material, name, quantity, marketBuy, marketSell, merchantValue })), totals }, null, 2), "application/json;charset=utf-8");
    notify("Vergleich als JSON exportiert.");
  };
  const exportCsv = () => {
    const header = ["Material", "Name", "Menge", "Markt-Kaufwert", "Markt-Verkaufswert", "Händlerwert OPShards"];
    const lines = calculated.map((item) => [item.material, item.name, item.quantity, item.marketBuy, item.marketSell, item.merchantValue].map((value) => escapeCsv(value)).join(","));
    downloadTextFile("opsucht-vergleich.csv", [header.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
    notify("Vergleich als CSV exportiert.");
  };

  if (prices.isPending || items.isPending || merchants.isPending || !hydrated) return <><PageHeader eyebrow="Portfolio" title="Vergleichsrechner" description="Mehrere reale Markt- und Händlerwerte gemeinsam berechnen." /><PageSkeleton /></>;
  if (prices.isError && merchants.isError) return <><PageHeader eyebrow="Portfolio" title="Vergleichsrechner" description="Mehrere reale Markt- und Händlerwerte gemeinsam berechnen." /><ErrorState message="Weder Markt- noch Händlerdaten konnten geladen werden." onRetry={() => { prices.refetch(); merchants.refetch(); }} /></>;

  const unavailableAreas = [prices.isError ? "Marktpreise" : null, items.isError ? "Item-Metadaten" : null, merchants.isError ? "Händlerkurse" : null]
    .filter((area): area is string => area !== null);
  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Vergleichsrechner" description="Itemmengen kombinieren und Kauf-, Verkaufs- sowie OPShards-Werte ausschließlich mit aktuellen API-Daten vergleichen." actions={<><DataFreshness meta={prices.data?.meta ?? merchants.data?.meta} fetching={prices.isFetching || merchants.isFetching} /><Button onClick={addPosition} variant="primary" disabled={!options.length}><Plus size={16} /> Position</Button></>} />
      {(prices.data?.meta.stale || merchants.data?.meta.stale) ? <StaleBanner message={prices.data?.meta.error ?? merchants.data?.meta.error} /> : null}
      {unavailableAreas.length ? <StaleBanner message={`Einige Berechnungsgrundlagen sind vorübergehend nicht verfügbar: ${unavailableAreas.join(", ")}. Fehlende Werte werden weiterhin ausdrücklich markiert.`} /> : null}
      <div className="stat-grid">
        <MetricCard label="Markt-Kaufwert" value={totals.availableBuy ? formatPrice(totals.marketBuy) : "Nicht verfügbar"} note={missingBuy ? `${missingBuy} Positionen ohne BUY-Kurs` : "Alle Positionen eingerechnet"} icon={ShoppingBasket} title={totals.availableBuy ? `Exakter Preis: ${formatExactPrice(totals.marketBuy)}` : undefined} />
        <MetricCard label="Markt-Verkaufswert" value={totals.availableSell ? formatPrice(totals.marketSell) : "Nicht verfügbar"} note={missingSell ? `${missingSell} Positionen ohne SELL-Kurs` : "Alle Positionen eingerechnet"} icon={WalletCards} color="#0ea5a4" title={totals.availableSell ? `Exakter Preis: ${formatExactPrice(totals.marketSell)}` : undefined} />
        <MetricCard label="Händlerwert" value={totals.availableMerchant ? `${formatEconomyValue(totals.merchant)} OPShards` : "Nicht verfügbar"} note={missingMerchant ? `${missingMerchant} Positionen ohne Händlerkurs` : "Alle Positionen eingerechnet"} icon={Save} color="#8b5cf6" />
        <MetricCard label="BUY minus SELL" value={totals.comparableCount ? formatPrice(totals.comparableDifference) : "Nicht verfügbar"} note={`${totals.comparableCount} von ${calculated.length} Positionen direkt vergleichbar`} icon={Scale} color="#f59e0b" title={totals.comparableCount ? `Exakter Betrag: ${formatExactPrice(totals.comparableDifference)}` : undefined} />
      </div>

      <Card className="mt-5">
        <CardHeader title="Positionen" description="Änderungen werden automatisch lokal auf diesem Gerät gespeichert" action={<div className="export-actions"><Button size="sm" onClick={exportJson} disabled={!calculated.length}><Download size={14} /> JSON</Button><Button size="sm" onClick={exportCsv} disabled={!calculated.length}><Download size={14} /> CSV</Button><Button size="sm" variant="danger" onClick={() => setClearOpen(true)} disabled={!calculated.length}><Trash2 size={14} /> Alle löschen</Button></div>} />
        {calculated.length === 0 ? <div className="p-4"><EmptyState title="Noch keine Positionen" description="Füge ein echtes Markt- oder Händleritem hinzu, um den Vergleich zu beginnen." action={<Button variant="primary" onClick={addPosition} disabled={!options.length}><Plus size={16} /> Erste Position hinzufügen</Button>} /></div> : <div className="calculator-positions">{calculated.map((position) => (
          <article className="calculator-position" key={position.id}>
            <div className="position-item"><ItemIcon src={position.icon} name={position.name} size={44} /><div className="field-group"><FieldLabel htmlFor={`item-${position.id}`}>Item</FieldLabel><Select id={`item-${position.id}`} value={position.material} onChange={(event) => updatePosition(position.id, { material: event.target.value })}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</Select></div></div>
            <div className="field-group position-quantity"><FieldLabel htmlFor={`quantity-${position.id}`}>Ganze Menge</FieldLabel><Input id={`quantity-${position.id}`} type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" value={position.quantity} onChange={(event) => updatePosition(position.id, { quantity: normalizeWholeItemQuantity(event.target.value) })} /></div>
            <PositionValue label="Markt-Kaufwert" value={position.marketBuy} currency="dollar" />
            <PositionValue label="Markt-Verkaufswert" value={position.marketSell} currency="dollar" />
            <PositionValue label="Händlerwert" value={position.merchantValue} currency="shards" />
            <div className="position-difference"><span>BUY minus SELL</span><strong>{position.marketBuy === null || position.marketSell === null ? "Nicht berechenbar" : <PriceValue value={position.marketBuy - position.marketSell} />}</strong>{(position.marketBuy === null || position.marketSell === null || position.merchantValue === null) ? <Badge tone="warning">Preis fehlt</Badge> : null}</div>
            <div className="position-actions"><Button variant="ghost" size="icon" onClick={() => duplicatePosition(position)} aria-label={`${position.name} duplizieren`}><CopyPlus size={17} /></Button><Button variant="ghost" size="icon" onClick={() => removePosition(position.id)} aria-label={`${position.name} entfernen`}><Trash2 size={17} /></Button></div>
          </article>
        ))}</div>}
      </Card>
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)} title="Alle Positionen löschen?" description="Diese Aktion entfernt den lokal gespeicherten Vergleich."><p className="muted-text">Die Positionen können danach nicht automatisch wiederhergestellt werden.</p><div className="dialog-footer-actions"><Button onClick={() => setClearOpen(false)}>Abbrechen</Button><Button variant="danger" onClick={() => { setPositions([]); setClearOpen(false); notify("Alle Vergleichspositionen wurden gelöscht.", "info"); }}><Trash2 size={16} /> Alle löschen</Button></div></Dialog>
      <p className="method-note">Fehlende Kurse werden nicht als Nullwert in fachliche Einzelwerte eingesetzt. Gesamtsummen addieren nur vorhandene Werte und weisen die Zahl fehlender Positionen ausdrücklich aus.</p>
    </>
  );
}

function PositionValue({ label, value, currency }: { label: string; value: number | null; currency: "dollar" | "shards" }) {
  return <div className="position-value"><span>{label}</span><strong className={value === null ? "missing-value" : undefined}>{value === null ? "Preis fehlt" : currency === "dollar" ? <PriceValue value={value} /> : `${formatEconomyValue(value)} OPShards`}</strong></div>;
}
