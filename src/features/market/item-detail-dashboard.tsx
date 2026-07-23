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
import { useMarketHistory, useMarketItems, useMarketPrice, useMarketPrices } from "@/hooks/use-opsucht";
import { useRecentMarketItems } from "@/hooks/use-recent-market-items";
import { formatDateTime, formatEconomyValue, formatExactPrice, formatMaterialName, formatPrice, formatShortDateTime, parseOpsuchtDate } from "@/lib/format";
import { calculateHistoryStats, flattenMarketPrices, sortValidHistoryPoints, splitOrderSides } from "@/lib/market";
import { normalizeMaterialKey } from "@/lib/material";
import type { HistoryPoint } from "@/lib/schemas";
import type { HistoryPeriod } from "@/lib/types";
import { cn, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const periods: Array<{ key: HistoryPeriod; label: string }> = [
  { key: "HOURLY", label: "Stunden" },
  { key: "DAILY", label: "Tage" },
  { key: "WEEKLY", label: "Wochen" },
  { key: "MONTHLY", label: "Monate" },
];

type HistoryCourse = "buyPrice" | "sellPrice";

const courses: Array<{ key: HistoryCourse; label: string }> = [
  { key: "buyPrice", label: "Kaufkurs" },
  { key: "sellPrice", label: "Verkaufskurs" },
];

export function ItemDetailDashboard({ material }: { material: string }) {
  const [period, setPeriod] = useState<HistoryPeriod>("HOURLY");
  const [course, setCourse] = useState<HistoryCourse>("buyPrice");
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
  const chartData = points.map((point) => ({
    ...point,
    time: parseOpsuchtDate(point.timestamp).getTime(),
    buyPrice: point.maxPrice,
    sellPrice: point.minPrice,
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

      <div className="stat-grid current-price-grid mt-4">
        <MetricCard label="Kaufkurs (BUY)" value={formatPrice(buyPrice)} note={`${formatEconomyValue(buyOrders)} aktive Kaufaufträge`} icon={ShoppingCart} title={`Exakter Preis: ${formatExactPrice(buyPrice)}`} />
        <MetricCard label="Verkaufskurs (SELL)" value={formatPrice(sellPrice)} note={`${formatEconomyValue(sellOrders)} aktive Verkaufsaufträge`} icon={Tag} color="#0ea5a4" title={`Exakter Preis: ${formatExactPrice(sellPrice)}`} />
      </div>

      <Card className="mt-5">
        <CardHeader title="Preisverlauf" description="Historische Kauf- und Verkaufskurse direkt aus der OPSUCHT-API" action={<div className="chart-controls">{periods.map((option) => <button key={option.key} className={cn(period === option.key && "active")} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</button>)}</div>} />
        <div className="history-toolbar"><div className="chart-controls">{courses.map((option) => <button key={option.key} className={cn(course === option.key && "active")} aria-pressed={course === option.key} onClick={() => setCourse(option.key)}>{option.label}</button>)}</div></div>
        {history.isError ? <div className="p-4"><ErrorState message={history.error.message} onRetry={() => history.refetch()} /></div> : chartData.length === 0 ? <div className="p-4"><EmptyState title="Kein Preisverlauf verfügbar" description={`Für ${name} enthält der Zeitraum ${period.toLocaleLowerCase("de-DE")} keine Datenpunkte.`} /></div> : (
          <>
            <div className="chart-container" role="img" aria-label={chartSummary(name, period, course, points)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 18, bottom: 2, left: 5 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => formatShortDateTime(new Date(value))} stroke="var(--text-muted)" fontSize={10} minTickGap={28} />
                  <YAxis tickFormatter={(value) => formatPrice(Number(value))} stroke="var(--text-muted)" fontSize={10} width={64} domain={["auto", "auto"]} />
                  <Tooltip content={<HistoryTooltip course={course} />} />
                  <Line type="monotone" dataKey={course} stroke="var(--accent)" strokeWidth={2} dot={chartData.length < 20} activeDot={{ r: 5 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="chart-summary">{chartSummary(name, period, course, points)}</p>
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

function HistoryTooltip({ active, payload, course }: { active?: boolean; payload?: Array<{ payload: HistoryPoint & { time: number; buyPrice: number; sellPrice: number }; value: number }>; course: HistoryCourse }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{formatDateTime(point.timestamp)}</strong><span>{courseLabel(course)}: {formatExactPrice(point[course])}</span></div>;
}

function courseLabel(course: HistoryCourse): string {
  return courses.find((item) => item.key === course)?.label ?? course;
}

function periodLabel(period: HistoryPeriod): string {
  return periods.find((item) => item.key === period)?.label ?? period;
}

function chartSummary(name: string, period: HistoryPeriod, course: HistoryCourse, points: HistoryPoint[]): string {
  if (!points.length) return `Keine ${periodLabel(period).toLocaleLowerCase("de-DE")} Daten für ${name}.`;
  const first = points[0]!;
  const last = points.at(-1)!;
  const pointValue = (point: HistoryPoint) => course === "buyPrice" ? point.maxPrice : point.minPrice;
  return `${points.length} ${periodLabel(period).toLocaleLowerCase("de-DE")} Datenpunkte für ${name}. ${courseLabel(course)} von ${formatExactPrice(pointValue(first))} am ${formatDateTime(first.timestamp)} bis ${formatExactPrice(pointValue(last))} am ${formatDateTime(last.timestamp)}.`;
}
