"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CircleDollarSign, Clock3, Gavel, PackageSearch, RefreshCw, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { PriceValue } from "@/components/price-value";
import { ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { useFavorites } from "@/components/favorites-provider";
import { useApiHealth, useAuctions, useMarketCategories, useMarketItems, useMarketPrices, useMerchantRates } from "@/hooks/use-opsucht";
import { fetchApi } from "@/lib/api-client";
import { formatDateTime, formatEconomyValue, formatExactPrice, formatMaterialName, formatPercentNumber, formatPrice, formatRelativeTime } from "@/lib/format";
import { flattenMarketPrices, sortValidHistoryPoints } from "@/lib/market";
import type { MarketHistoryResponse } from "@/lib/schemas";
import type { MarketMovement } from "@/lib/types";

export function OverviewDashboard() {
  const auctions = useAuctions();
  const prices = useMarketPrices();
  const items = useMarketItems();
  const categories = useMarketCategories();
  const merchants = useMerchantRates();
  const health = useApiHealth();
  const favorites = useFavorites();

  const loading = [auctions, prices, items, categories, merchants].some((query) => query.isPending);
  const allFailed = [auctions, prices, items, categories, merchants].every((query) => query.isError);
  const now = useOverviewClock();
  const activeAuctions = useMemo(
    () => (auctions.data?.data ?? []).filter((auction) => new Date(auction.endTime).getTime() > now),
    [auctions.data, now],
  );
  const marketRows = useMemo(
    () => flattenMarketPrices(prices.data?.data ?? {}, items.data?.data ?? []),
    [prices.data, items.data],
  );
  const endingSoon = activeAuctions
    .filter((auction) => new Date(auction.endTime).getTime() - now <= 15 * 60_000)
    .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());

  const highPrices = marketRows
    .filter((row) => row.buyPrice !== null)
    .sort((a, b) => (b.buyPrice ?? 0) - (a.buyPrice ?? 0))
    .slice(0, 4);
  const lowPrices = marketRows
    .filter((row) => row.buyPrice !== null && row.buyPrice > 0)
    .sort((a, b) => (a.buyPrice ?? 0) - (b.buyPrice ?? 0))
    .slice(0, 4);
  const favoriteRows = marketRows.filter((row) => favorites.market.includes(row.material)).slice(0, 5);

  if (loading) return <><PageHeader eyebrow="Live-Wirtschaft" title="Wirtschaft im Überblick" description="Die wichtigsten Markt-, Auktions- und Händlerdaten in einer gemeinsamen Analyseansicht." /><PageSkeleton cards={4} /></>;
  if (allFailed) return <><PageHeader eyebrow="Live-Wirtschaft" title="Wirtschaft im Überblick" description="Die wichtigsten Markt-, Auktions- und Händlerdaten in einer gemeinsamen Analyseansicht." /><ErrorState onRetry={() => { auctions.refetch(); prices.refetch(); items.refetch(); categories.refetch(); merchants.refetch(); }} /></>;

  const stale = [auctions.data?.meta, prices.data?.meta, items.data?.meta, categories.data?.meta, merchants.data?.meta].some((meta) => meta?.stale);
  const unavailableAreas = [
    auctions.isError ? "Auktionen" : null,
    prices.isError ? "Marktpreise" : null,
    items.isError ? "Marktitems" : null,
    categories.isError ? "Marktkategorien" : null,
    merchants.isError ? "Händlerkurse" : null,
  ].filter((area): area is string => area !== null);
  const lastUpdated = [auctions.data?.meta.cachedAt, prices.data?.meta.cachedAt, merchants.data?.meta.cachedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Live-Wirtschaft"
        title="Wirtschaft im Überblick"
        description="Echte öffentliche OPSUCHT-Daten, übersichtlich aufbereitet für schnelle Entscheidungen und tiefere Marktanalysen."
        actions={<DataFreshness meta={prices.data?.meta} fetching={prices.isFetching} />}
      />
      {stale ? <StaleBanner /> : null}
      {unavailableAreas.length ? <StaleBanner message={`Einige Datenbereiche sind vorübergehend nicht verfügbar: ${unavailableAreas.join(", ")}. Verfügbare Bereiche bleiben nutzbar.`} /> : null}
      <div className="stat-grid">
        <MetricCard label="Laufende Auktionen" value={formatEconomyValue(activeAuctions.length)} note={`${formatEconomyValue(endingSoon.length)} enden in 15 Minuten`} icon={Gavel} />
        <MetricCard label="Erfasste Marktitems" value={formatEconomyValue(marketRows.length || items.data?.data.length)} note={`${formatEconomyValue(categories.data?.data.length)} Kategorien verfügbar`} icon={Store} color="#0ea5a4" />
        <MetricCard label="Händlerkurse" value={formatEconomyValue(merchants.data?.data.length)} note="Aktuelle Umrechnung in OPShards" icon={CircleDollarSign} color="#8b5cf6" />
        <MetricCard label="API-Bereiche" value={health.data ? `${health.data.healthy}/${health.data.total}` : "Wird geprüft"} note={lastUpdated ? `Stand ${formatDateTime(lastUpdated)}` : "Noch keine Aktualisierung"} icon={Activity} color="#f59e0b" />
      </div>

      <div className="section-grid dashboard-grid mt-5">
        <MarketMovementCard rows={marketRows} />
        <Card>
          <CardHeader title="Bald endende Auktionen" description="Restzeit unter 15 Minuten" action={<LinkButton href="/auctions?soon=1" size="sm">Alle anzeigen <ArrowRight size={14} /></LinkButton>} />
          <div className="list-body">
            {endingSoon.length ? endingSoon.slice(0, 6).map((auction) => {
              const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
              return (
                <Link className="list-row" href={`/auctions?q=${encodeURIComponent(name)}&soon=1`} key={auction.uid}>
                  <ItemIcon src={auction.item.icon} name={name} size={37} />
                  <div className="list-row-main"><strong>{name}</strong><small>{auction.item.amount} Stück · {auction.category}</small></div>
                  <div className="list-row-value"><strong><PriceValue value={auction.currentBid} /></strong><small>{formatRelativeTime(auction.endTime)}</small></div>
                </Link>
              );
            }) : <div className="compact-empty"><Clock3 size={21} /><p>Aktuell endet keine Auktion innerhalb von 15 Minuten.</p></div>}
          </div>
        </Card>
      </div>

      <div className="section-grid dashboard-grid mt-5">
        <Card>
          <CardHeader title="Preisextreme" description="Aktuelle BUY-Kurse, nicht historische Höchst- oder Tiefstwerte" action={<LinkButton href="/market" size="sm">Markt öffnen <ArrowRight size={14} /></LinkButton>} />
          <div className="price-extremes">
            <PriceList title="Hohe Preise" rows={highPrices} tone="high" />
            <PriceList title="Niedrige Preise" rows={lowPrices} tone="low" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Favorisierte Items" description="Persönlicher Schnellzugriff auf diesem Gerät" action={<LinkButton href="/favorites" size="sm">Favoriten <ArrowRight size={14} /></LinkButton>} />
          <div className="list-body">
            {favoriteRows.length ? favoriteRows.map((row) => (
              <Link className="list-row" href={`/market/${encodeURIComponent(row.material)}`} key={row.material}>
                <ItemIcon src={row.icon} name={row.name} size={37} />
                <div className="list-row-main"><strong>{row.name}</strong><small>{row.category}</small></div>
                <div className="list-row-value"><strong><PriceValue value={row.buyPrice} /></strong><small>BUY-Kurs</small></div>
              </Link>
            )) : <div className="compact-empty"><PackageSearch size={21} /><p>Noch keine Marktitems gespeichert. Sterne im Markt füllen diesen Bereich.</p></div>}
          </div>
        </Card>
      </div>
    </>
  );
}

function useOverviewClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function MarketMovementCard({ rows }: { rows: ReturnType<typeof flattenMarketPrices> }) {
  const candidates = useMemo(
    () => [...rows].sort((a, b) => b.buyOrders + b.sellOrders - (a.buyOrders + a.sellOrders)).slice(0, 4),
    [rows],
  );
  const queries = useQueries({
    queries: candidates.map((row) => ({
      queryKey: ["market-history", row.material],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchApi<MarketHistoryResponse>(`/api/opsucht/market/history/${encodeURIComponent(row.material)}`, signal),
      staleTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const movements: MarketMovement[] = candidates.flatMap((row, index) => {
    const points = queries[index]?.data?.data.HOURLY ?? [];
    const sorted = sortValidHistoryPoints(points);
    const previous = sorted.at(-2);
    const current = sorted.at(-1);
    if (!previous || !current) return [];
    const absoluteChange = current.avgPrice - previous.avgPrice;
    return [{ ...row, previous, current, absoluteChange, percentChange: previous.avgPrice > 0 ? (absoluteChange / previous.avgPrice) * 100 : null }];
  });
  const loading = queries.some((query) => query.isPending);

  return (
    <Card>
      <CardHeader title="Ausgewählte Marktbewegungen" description="Vergleich der letzten zwei echten stündlichen Durchschnittswerte" />
      <div className="movement-grid">
        {movements.length ? movements.map((movement) => {
          const rising = movement.absoluteChange > 0;
          const falling = movement.absoluteChange < 0;
          return (
            <Link href={`/market/${encodeURIComponent(movement.material)}`} className="movement-item" key={movement.material}>
              <div className="movement-head"><ItemIcon src={movement.icon} name={movement.name} size={38} /><div><strong>{movement.name}</strong><small>{movement.category}</small></div></div>
              <div className="movement-values"><strong title={`Exakter Preis: ${formatExactPrice(movement.current.avgPrice)}`}>{formatPrice(movement.current.avgPrice)}</strong><Badge tone={rising ? "success" : falling ? "danger" : "neutral"}>{rising ? <ArrowUpRight size={12} /> : falling ? <ArrowDownRight size={12} /> : null}{formatPercentNumber(movement.percentChange)}</Badge></div>
              <small className="movement-note">Vorher <span title={`Exakter Preis: ${formatExactPrice(movement.previous.avgPrice)}`}>{formatPrice(movement.previous.avgPrice)}</span> · {formatDateTime(movement.current.timestamp)}</small>
            </Link>
          );
        }) : loading
          ? <div className="compact-empty col-span-full" role="status"><RefreshCw size={21} className="spin" /><p>Vergleichsdaten werden geladen.</p></div>
          : <div className="compact-empty col-span-full"><Activity size={21} /><p>Für die ausgewählten Items ist noch keine belastbare Vergleichsbasis verfügbar.</p></div>}
      </div>
      <p className="chart-summary">Es werden keine künstlichen Trends berechnet. Die Veränderung basiert ausschließlich auf zwei vorhandenen API-Datenpunkten.</p>
    </Card>
  );
}

function PriceList({ title, rows, tone }: { title: string; rows: ReturnType<typeof flattenMarketPrices>; tone: "high" | "low" }) {
  return (
    <section><h3><span className={`price-indicator ${tone}`} />{title}</h3>{rows.map((row) => (
      <Link className="list-row" href={`/market/${encodeURIComponent(row.material)}`} key={row.material}>
        <ItemIcon src={row.icon} name={row.name} size={35} />
        <div className="list-row-main"><strong>{row.name}</strong><small>{row.category}</small></div>
        <div className="list-row-value"><strong><PriceValue value={row.buyPrice} /></strong><small>BUY</small></div>
      </Link>
    ))}</section>
  );
}
