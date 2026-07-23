"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BarChart3, Copy, Heart, Package, RefreshCw, ShoppingCart, Tag, TrendingDown, TrendingUp } from "lucide-react";
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
import { useMarketHistory, useMarketItems, useMarketPrice, useMarketPrices } from "@/hooks/use-opsucht";
import { useRecentMarketItems } from "@/hooks/use-recent-market-items";
import { formatDateTime, formatEconomyValue, formatExactPrice, formatMaterialName, formatNumber, formatPercentNumber, formatPrice, formatShortDateTime, parseOpsuchtDate } from "@/lib/format";
import { calculateHistoryStats, calculateSpread, flattenMarketPrices, sortValidHistoryPoints, splitOrderSides } from "@/lib/market";
import { normalizeMaterialKey } from "@/lib/material";
import type { HistoryPoint } from "@/lib/schemas";
import type { HistoryMetric, HistoryPeriod } from "@/lib/types";
import { cn, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const periods: Array<{ key: HistoryPeriod; label: string }> = [
  { key: "HOURLY", label: "Stündlich" },
  { key: "DAILY", label: "Täglich" },
  { key: "WEEKLY", label: "Wöchentlich" },
  { key: "MONTHLY", label: "Monatlich" },
];

const metrics: Array<{ key: HistoryMetric; label: string }> = [
  { key: "avgPrice", label: "Durchschnitt" },
  { key: "minPrice", label: "Minimum" },
  { key: "maxPrice", label: "Maximum" },
  { key: "items", label: "Itemmenge" },
  { key: "transactions", label: "Transaktionen" },
];

export function ItemDetailDashboard({ material }: { material: string }) {
  const [period, setPeriod] = useState<HistoryPeriod>("HOURLY");
  const [metric, setMetric] = useState<HistoryMetric>("avgPrice");
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
  const spread = calculateSpread(buyPrice, sellPrice);
  const points = useMemo(
    () => sortValidHistoryPoints([...(history.data?.data[period] ?? [])]),
    [history.data, period],
  );
  const stats = calculateHistoryStats(points);
  const name = row?.name ?? formatMaterialName(material);
  const chartData = points.map((point) => ({ ...point, time: parseOpsuchtDate(point.timestamp).getTime() }));
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
    <>
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

      <div className="stat-grid mt-4">
        <MetricCard label="Kaufkurs (BUY)" value={formatPrice(buyPrice)} note={`${formatEconomyValue(buyOrders)} aktive Kaufaufträge`} icon={ShoppingCart} title={`Exakter Preis: ${formatExactPrice(buyPrice)}`} />
        <MetricCard label="Verkaufskurs (SELL)" value={formatPrice(sellPrice)} note={`${formatEconomyValue(sellOrders)} aktive Verkaufsaufträge`} icon={Tag} color="#0ea5a4" title={`Exakter Preis: ${formatExactPrice(sellPrice)}`} />
        <MetricCard label="Absoluter Spread" value={formatPrice(spread.spread)} note="Höherer Kurs minus niedrigerer Kurs" icon={RefreshCw} color="#8b5cf6" title={`Exakter Betrag: ${formatExactPrice(spread.spread)}`} />
        <MetricCard label="Relativer Spread" value={formatPercentNumber(spread.percent)} note="Basis: niedrigerer Kurs" icon={BarChart3} color="#f59e0b" />
      </div>

      <Card className="mt-5">
        <CardHeader title="Preisverlauf" description="Historische Werte direkt aus der OPSUCHT-API" action={<div className="chart-controls">{periods.map((option) => <button key={option.key} className={cn(period === option.key && "active")} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</button>)}</div>} />
        <div className="history-toolbar"><div className="chart-controls">{metrics.map((option) => <button key={option.key} className={cn(metric === option.key && "active")} aria-pressed={metric === option.key} onClick={() => setMetric(option.key)}>{option.label}</button>)}</div></div>
        {history.isError ? <div className="p-4"><ErrorState message={history.error.message} onRetry={() => history.refetch()} /></div> : chartData.length === 0 ? <div className="p-4"><EmptyState title="Kein Preisverlauf verfügbar" description={`Für ${name} enthält der Zeitraum ${period.toLocaleLowerCase("de-DE")} keine Datenpunkte.`} /></div> : (
          <>
            <div className="chart-container" role="img" aria-label={chartSummary(name, period, metric, points)}>
              <ResponsiveContainer width="100%" height="100%">
                {metric === "items" || metric === "transactions" ? (
                  <AreaChart data={chartData} margin={{ top: 12, right: 18, bottom: 2, left: 5 }}>
                    <defs><linearGradient id="metricArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28}/><stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02}/></linearGradient></defs>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => formatShortDateTime(new Date(value))} stroke="var(--text-muted)" fontSize={10} minTickGap={28} />
                    <YAxis tickFormatter={(value) => formatEconomyValue(Number(value))} stroke="var(--text-muted)" fontSize={10} width={54} />
                    <Tooltip content={<HistoryTooltip metric={metric} />} />
                    <Area type="monotone" dataKey={metric} stroke="var(--accent)" strokeWidth={2} fill="url(#metricArea)" connectNulls={false} />
                  </AreaChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 12, right: 18, bottom: 2, left: 5 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => formatShortDateTime(new Date(value))} stroke="var(--text-muted)" fontSize={10} minTickGap={28} />
                    <YAxis tickFormatter={(value) => formatPrice(Number(value))} stroke="var(--text-muted)" fontSize={10} width={64} domain={["auto", "auto"]} />
                    <Tooltip content={<HistoryTooltip metric={metric} />} />
                    <Line type="monotone" dataKey={metric} stroke="var(--accent)" strokeWidth={2} dot={chartData.length < 20} activeDot={{ r: 5 }} connectNulls={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            <p className="chart-summary">{chartSummary(name, period, metric, points)}</p>
          </>
        )}
      </Card>

      <div className="stat-grid history-stats mt-4">
        <MetricCard label="Minimum im Zeitraum" value={formatPrice(stats.minimum)} note={historyNote} icon={TrendingDown} title={`Exakter Preis: ${formatExactPrice(stats.minimum)}`} />
        <MetricCard label="Maximum im Zeitraum" value={formatPrice(stats.maximum)} note={historyNote} icon={TrendingUp} color="#c2414b" title={`Exakter Preis: ${formatExactPrice(stats.maximum)}`} />
        <MetricCard label="Ø der Datenpunkte" value={formatPrice(stats.average)} note={history.isError ? historyNote : "Arithmetisches Mittel der avgPrice-Werte"} icon={BarChart3} color="#8b5cf6" title={`Exakter Preis: ${formatExactPrice(stats.average)}`} />
        <MetricCard label="Handelsaktivität" value={history.isError ? "Nicht verfügbar" : `${formatEconomyValue(stats.items)} Items`} note={history.isError ? historyNote : `${formatEconomyValue(stats.transactions)} Transaktionen`} icon={Package} color="#0ea5a4" />
      </div>
    </>
  );
}

function HistoryTooltip({ active, payload, metric }: { active?: boolean; payload?: Array<{ payload: HistoryPoint & { time: number }; value: number }>; metric: HistoryMetric }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const priceMetric = metric === "avgPrice" || metric === "minPrice" || metric === "maxPrice";
  return <div className="chart-tooltip"><strong>{formatDateTime(point.timestamp)}</strong><span>{metricLabel(metric)}: {priceMetric ? formatExactPrice(point[metric]) : formatNumber(point[metric], 2)}</span><small>Min. {formatExactPrice(point.minPrice)} · Max. {formatExactPrice(point.maxPrice)}</small><small>{formatEconomyValue(point.items)} Items · {formatEconomyValue(point.transactions)} Transaktionen</small></div>;
}

function metricLabel(metric: HistoryMetric): string {
  return metrics.find((item) => item.key === metric)?.label ?? metric;
}

function periodLabel(period: HistoryPeriod): string {
  return periods.find((item) => item.key === period)?.label ?? period;
}

function chartSummary(name: string, period: HistoryPeriod, metric: HistoryMetric, points: HistoryPoint[]): string {
  if (!points.length) return `Keine ${periodLabel(period).toLocaleLowerCase("de-DE")} Daten für ${name}.`;
  const first = points[0]!;
  const last = points.at(-1)!;
  const formatMetric = (value: number) => metric === "avgPrice" || metric === "minPrice" || metric === "maxPrice" ? formatExactPrice(value) : formatNumber(value, 4);
  return `${points.length} ${periodLabel(period).toLocaleLowerCase("de-DE")} Datenpunkte für ${name}. ${metricLabel(metric)} von ${formatMetric(first[metric])} am ${formatDateTime(first.timestamp)} bis ${formatMetric(last[metric])} am ${formatDateTime(last.timestamp)}.`;
}
