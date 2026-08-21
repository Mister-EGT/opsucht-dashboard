"use client";

import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BarChart3, Copy, Heart, Package, ShoppingCart, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { RefreshButton } from "@/components/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { ScrollProgress, type ScrollProgressSection } from "@/components/ui/scroll-progress";
import { useMarketHistory, useMarketItems, useMarketPrice, useMarketPrices } from "@/hooks/use-opsucht";
import { useRecentMarketItems } from "@/hooks/use-recent-market-items";
import { formatDateTime, formatDetailedPrice, formatEconomyValue, formatMaterialName, formatPrice, formatShortDateTime, parseOpsuchtDate } from "@/lib/format";
import { calculateHistoryStats, flattenMarketPrices, historyChartSeries, sortValidHistoryPoints, splitOrderSides } from "@/lib/market";
import { normalizeMaterialKey } from "@/lib/material";
import type { HistoryPoint } from "@/lib/schemas";
import type { HistoryPeriod } from "@/lib/types";
import { cn, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const periods: Array<{ key: HistoryPeriod; label: string; viewLabel: string }> = [
  { key: "HOURLY", label: "Stunden", viewLabel: "Stundenansicht" },
  { key: "DAILY", label: "Tage", viewLabel: "Tagesansicht" },
  { key: "WEEKLY", label: "Wochen", viewLabel: "Wochenansicht" },
  { key: "MONTHLY", label: "Monate", viewLabel: "Monatsansicht" },
];

const ITEM_DETAIL_SECTIONS: ScrollProgressSection[] = [
  { id: "market-item-start", label: "Item-Überblick" },
  { id: "market-item-prices", label: "Aktuelle Kurse" },
  { id: "market-item-history", label: "Preisverlauf" },
  { id: "market-item-stats", label: "Historische Kennzahlen" },
];

export function ItemDetailDashboard({ material }: { material: string }) {
  const [period, setPeriod] = useState<HistoryPeriod>("WEEKLY");
  const price = useMarketPrice(material);
  const history = useMarketHistory(material);
  const allPrices = useMarketPrices();
  const items = useMarketItems();
  const favorites = useFavorites();
  const { remember: rememberRecentItem } = useRecentMarketItems();
  const { notify } = useToast();

  const marketRows = useMemo(() => flattenMarketPrices(allPrices.data?.data ?? {}, items.data?.data ?? []), [allPrices.data, items.data]);
  const normalizedMaterial = normalizeMaterialKey(material);
  const row = marketRows.find((candidate) => normalizeMaterialKey(candidate.material) === normalizedMaterial);
  const orderArray = price.data
    ? Object.entries(price.data.data).find(([key]) => normalizeMaterialKey(key) === normalizedMaterial)?.[1] ?? []
    : [];
  const { buy, sell } = splitOrderSides(orderArray);
  const directBuyPrice = buy && !(buy.price === 0 && buy.activeOrders === 0) ? buy.price : null;
  const directSellPrice = sell && !(sell.price === 0 && sell.activeOrders === 0) ? sell.price : null;
  const buyPrice = price.isError ? row?.buyPrice ?? null : directBuyPrice;
  const sellPrice = price.isError ? row?.sellPrice ?? null : directSellPrice;
  const buyOrders = price.isError ? row?.buyOrders ?? 0 : buy?.activeOrders ?? 0;
  const sellOrders = price.isError ? row?.sellOrders ?? 0 : sell?.activeOrders ?? 0;
  const currentPriceMeta = price.data?.meta ?? allPrices.data?.meta;
  const usingPriceFallback = price.isError && Boolean(row);
  const points = useMemo(
    () => sortValidHistoryPoints([...(history.data?.data[period] ?? [])]),
    [history.data, period],
  );
  const stats = calculateHistoryStats(points);
  const name = row?.name ?? formatMaterialName(material);
  const [historySeries] = historyChartSeries(period);
  const chartData = points.map((point) => ({
    ...point,
    time: parseOpsuchtDate(point.timestamp).getTime(),
  }));
  const historyNote = history.isError ? "Preisverlauf nicht verfügbar" : periodLabel(period);

  useEffect(() => {
    if (!price.data && !row) return;
    rememberRecentItem({ material: normalizedMaterial, name, category: row?.category ?? null, icon: row?.icon ?? null });
  }, [price.data, row, normalizedMaterial, name, rememberRecentItem]);

  const copyMaterial = async () => {
    const copied = await copyToClipboard(normalizedMaterial);
    notify(copied ? "Materialname kopiert." : "Der Materialname konnte nicht kopiert werden.", copied ? "success" : "danger");
  };

  if (price.isPending || history.isPending || (price.isError && allPrices.isPending)) return <><PageHeader eyebrow="Item-Analyse" title={name} description="Kurse und Preisverlauf werden geladen." /><PageSkeleton /></>;
  if (price.isError && !row) return <><PageHeader eyebrow="Item-Analyse" title={name} description="Aktuelle Kurse und historische Marktdaten." /><ErrorState message={price.error.message} onRetry={() => { price.refetch(); allPrices.refetch(); }} /></>;

  return (
    <div id="market-item-start" className="scroll-progress-section">
      <ScrollProgress sections={ITEM_DETAIL_SECTIONS} />
      <Link className="back-link" href={row?.category ? `/market?category=${encodeURIComponent(row.category)}` : "/market"}><ArrowLeft size={15} /> Zurück zur {row?.category ? `Kategorie ${row.category}` : "Marktübersicht"}</Link>
      <PageHeader
        eyebrow="Item-Analyse"
        title={name}
        description={`Technisches Material: ${material}`}
        actions={<><DataFreshness meta={currentPriceMeta} fetching={price.isFetching || (price.isError && allPrices.isFetching)} /><RefreshButton fetching={price.isFetching || history.isFetching || allPrices.isFetching || items.isFetching} onRefresh={() => { price.refetch(); history.refetch(); allPrices.refetch(); items.refetch(); }} /><Button onClick={copyMaterial}><Copy size={16} /> Material kopieren</Button><Button variant={favorites.isMarketFavorite(material) ? "primary" : "secondary"} onClick={() => favorites.toggleMarket(material)}><Heart size={16} fill={favorites.isMarketFavorite(material) ? "currentColor" : "none"} />{favorites.isMarketFavorite(material) ? "Favorisiert" : "Favorisieren"}</Button></>}
      />
      {(currentPriceMeta?.stale || history.data?.meta.stale) ? <StaleBanner message={currentPriceMeta?.error ?? history.data?.meta.error} /> : null}
      {usingPriceFallback ? <StaleBanner message="Der einzelne Kursendpunkt ist vorübergehend nicht verfügbar. Die aktuellen Kurse werden aus dem globalen Marktfeed angezeigt." /> : null}
      {(allPrices.isError || items.isError) ? <StaleBanner message="Kategorie oder Item-Metadaten sind vorübergehend nicht verfügbar. Aktueller Kurs und Preisverlauf bleiben davon unberührt." /> : null}

      <Card className="item-identity-card">
        <ItemIcon src={row?.icon} name={name} size={58} />
        <div><h2>{name}</h2><p>{material}</p></div>
        <Badge tone="accent">{row?.category ?? "Kategorie nicht zugeordnet"}</Badge>
        <div className="identity-update"><span>Letzte Aktualisierung</span><strong>{formatDateTime(currentPriceMeta?.cachedAt)}</strong></div>
      </Card>

      <div id="market-item-prices" className="stat-grid current-price-grid scroll-progress-section mt-4">
        <MetricCard label="Kaufkurs (BUY)" value={formatPrice(buyPrice)} note={`${formatEconomyValue(buyOrders)} aktive Kaufaufträge`} icon={ShoppingCart} title={`Preis: ${formatDetailedPrice(buyPrice)}`} />
        <MetricCard label="Verkaufskurs (SELL)" value={formatPrice(sellPrice)} note={`${formatEconomyValue(sellOrders)} aktive Verkaufsaufträge`} icon={Tag} color="#0ea5a4" title={`Preis: ${formatDetailedPrice(sellPrice)}`} />
      </div>

      <Card id="market-item-history" className="scroll-progress-section mt-5">
        <CardHeader title="Preisverlauf" description="Durchschnittlicher Transaktionspreis aus der Markt-Historie" action={<div className="chart-controls" aria-label="Zeitraum auswählen">{periods.map((option) => <button key={option.key} className={cn(period === option.key && "active")} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</button>)}</div>} />
        {history.isError ? <div className="p-4"><ErrorState message={history.error.message} onRetry={() => history.refetch()} /></div> : chartData.length === 0 ? <div className="p-4"><EmptyState title="Kein Preisverlauf verfügbar" description={`Für ${name} enthält die ${periodViewLabel(period)} keine Datenpunkte.`} /></div> : (
          <>
            <div className="chart-container" role="img" aria-label={chartSummary(name, period, points)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 18, bottom: 2, left: 5 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => formatShortDateTime(new Date(value))} stroke="var(--text-muted)" fontSize={10} minTickGap={28} />
                  <YAxis tickFormatter={(value) => formatPrice(Number(value))} stroke="var(--text-muted)" fontSize={10} width={64} domain={["auto", "auto"]} />
                  <Tooltip content={<HistoryTooltip />} />
                  <Line type="monotone" dataKey={historySeries} name="Ø Preis" stroke="#3b82f6" strokeWidth={2} dot={chartData.length < 20} activeDot={{ r: 5 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <div id="market-item-stats" className="stat-grid history-stats scroll-progress-section mt-4">
        <MetricCard label="Niedrigster Ø-Kurs" value={formatPrice(stats.minimum)} note={historyNote} icon={TrendingDown} title={`Preis: ${formatDetailedPrice(stats.minimum)}`} />
        <MetricCard label="Höchster Ø-Kurs" value={formatPrice(stats.maximum)} note={historyNote} icon={TrendingUp} color="#c2414b" title={`Preis: ${formatDetailedPrice(stats.maximum)}`} />
        <MetricCard label="Ø der Datenpunkte" value={formatPrice(stats.average)} note={history.isError ? historyNote : "Arithmetisches Mittel der avgPrice-Werte"} icon={BarChart3} color="#8b5cf6" title={`Preis: ${formatDetailedPrice(stats.average)}`} />
        <MetricCard label="Handelsaktivität" value={history.isError ? "Nicht verfügbar" : `${formatEconomyValue(stats.items)} Items`} note={history.isError ? historyNote : `${formatEconomyValue(stats.transactions)} Transaktionen`} icon={Package} color="#0ea5a4" />
      </div>
    </div>
  );
}

function HistoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HistoryPoint & { time: number }; value: number }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{formatDateTime(point.timestamp)}</strong><span>Ø Preis: {formatDetailedPrice(point.avgPrice)}</span></div>;
}

function periodLabel(period: HistoryPeriod): string {
  return periods.find((item) => item.key === period)?.label ?? period;
}

function periodViewLabel(period: HistoryPeriod): string {
  return periods.find((item) => item.key === period)?.viewLabel ?? period;
}

function chartSummary(name: string, period: HistoryPeriod, points: HistoryPoint[]): string {
  if (!points.length) return `Für ${name} sind in der ${periodViewLabel(period)} keine Daten verfügbar.`;
  const first = points[0]!;
  const last = points.at(-1)!;
  return `${points.length} Datenpunkte in der ${periodViewLabel(period)} für ${name}. Durchschnittlicher Transaktionspreis von ${formatDetailedPrice(first.avgPrice)} am ${formatDateTime(first.timestamp)} bis ${formatDetailedPrice(last.avgPrice)} am ${formatDateTime(last.timestamp)}.`;
}
