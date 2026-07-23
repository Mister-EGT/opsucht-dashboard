"use client";

/* eslint-disable react-hooks/incompatible-library */

import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Heart, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { PriceValue } from "@/components/price-value";
import { PageHeader } from "@/components/page-header";
import { RefreshButton } from "@/components/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { useMarketCategories, useMarketItems, useMarketPrices } from "@/hooks/use-opsucht";
import { marketFilterHref, parseMarketFilters, type MarketAvailability } from "@/lib/filter-url";
import { formatEconomyValue, formatPercentNumber } from "@/lib/format";
import { flattenMarketPrices } from "@/lib/market";
import type { MarketRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MarketDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchKey = searchParams.toString();
  const [filters, setFilters] = useState(() => parseMarketFilters(searchKey));
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const prices = useMarketPrices();
  const items = useMarketItems();
  const categories = useMarketCategories();
  const favorites = useFavorites();

  useEffect(() => {
    const next = parseMarketFilters(searchKey);
    setFilters((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [searchKey]);

  const updateFilters = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    router.replace(marketFilterHref(next), { scroll: false });
  };

  const { query, category, availability, density } = filters;

  const rows = useMemo(() => flattenMarketPrices(prices.data?.data ?? {}, items.data?.data ?? []), [prices.data, items.data]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    return rows.filter((row) => {
      if (category && row.category !== category) return false;
      if (normalized && !`${row.name} ${row.material} ${row.category}`.toLocaleLowerCase("de-DE").includes(normalized)) return false;
      if (availability === "tradable" && row.buyOrders + row.sellOrders === 0) return false;
      if (availability === "incomplete" && row.complete) return false;
      return true;
    });
  }, [rows, query, category, availability]);

  const columns = useMemo<ColumnDef<MarketRow>[]>(() => [
    { id: "favorite", header: () => <span className="sr-only">Favorit</span>, enableSorting: false, cell: ({ row }) => <Button size="icon" variant="ghost" onClick={() => favorites.toggleMarket(row.original.material)} aria-label="Favorit umschalten"><Heart size={16} fill={favorites.isMarketFavorite(row.original.material) ? "currentColor" : "none"} /></Button> },
    { accessorKey: "name", header: "Item", cell: ({ row }) => <Link href={`/market/${encodeURIComponent(row.original.material)}`} className="item-cell"><ItemIcon src={row.original.icon} name={row.original.name} size={38} /><div><strong>{row.original.name}</strong><small>{row.original.material}</small></div></Link> },
    { accessorKey: "category", header: "Kategorie", cell: ({ getValue }) => <Badge>{String(getValue())}</Badge> },
    { id: "buyPrice", accessorFn: (row) => row.buyPrice ?? undefined, header: "Kaufkurs (BUY)", meta: { numeric: true }, sortUndefined: "last", cell: ({ getValue }) => <strong><PriceValue value={getValue<number | undefined>()} /></strong> },
    { id: "sellPrice", accessorFn: (row) => row.sellPrice ?? undefined, header: "Verkaufskurs (SELL)", meta: { numeric: true }, sortUndefined: "last", cell: ({ getValue }) => <PriceValue value={getValue<number | undefined>()} /> },
    { id: "spread", accessorFn: (row) => row.spread ?? undefined, header: "Spread absolut", meta: { numeric: true, detail: true }, sortUndefined: "last", cell: ({ getValue }) => <PriceValue value={getValue<number | undefined>()} /> },
    { id: "spreadPercent", accessorFn: (row) => row.spreadPercent ?? undefined, header: "Spread relativ", meta: { numeric: true, detail: true }, sortUndefined: "last", cell: ({ getValue }) => <span title="Berechnungsbasis: niedrigerer der beiden Preise">{formatPercentNumber(getValue<number | undefined>())}</span> },
    { accessorKey: "buyOrders", header: "Kaufaufträge", meta: { numeric: true, detail: true }, cell: ({ getValue }) => formatEconomyValue(getValue<number>()) },
    { accessorKey: "sellOrders", header: "Verkaufsaufträge", meta: { numeric: true, detail: true }, cell: ({ getValue }) => formatEconomyValue(getValue<number>()) },
  ], [favorites]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
      columnVisibility: density === "compact" ? { spread: false, spreadPercent: false, buyOrders: false, sellOrders: false } : {},
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 30 } },
  });

  if (prices.isPending || items.isPending || categories.isPending) return <><PageHeader eyebrow="Marktdaten" title="Marktübersicht" description="Preise, Aufträge und Spreads für alle erfassten Items." /><PageSkeleton /></>;
  if (prices.isError) return <><PageHeader eyebrow="Marktdaten" title="Marktübersicht" description="Preise, Aufträge und Spreads für alle erfassten Items." /><ErrorState message={prices.error.message} onRetry={() => prices.refetch()} /></>;

  const clear = () => updateFilters({ query: "", category: "", availability: "all" });
  const unavailableAreas = [items.isError ? "Item-Metadaten" : null, categories.isError ? "Marktkategorien" : null]
    .filter((area): area is string => area !== null);
  return (
    <>
      <PageHeader eyebrow="Marktdaten" title="Marktübersicht" description="BUY- und SELL-Kurse werden anhand von orderSide zugeordnet, unabhängig von ihrer Reihenfolge in der API." actions={<><DataFreshness meta={prices.data?.meta} fetching={prices.isFetching} /><RefreshButton fetching={prices.isFetching || items.isFetching || categories.isFetching} onRefresh={() => { prices.refetch(); items.refetch(); categories.refetch(); }} /></>} />
      {prices.data?.meta.stale ? <StaleBanner message={prices.data.meta.error} /> : null}
      {unavailableAreas.length ? <StaleBanner message={`Zusatzdaten sind vorübergehend nicht verfügbar: ${unavailableAreas.join(", ")}. Die vorhandenen Marktpreise werden weiterhin angezeigt.`} /> : null}
      <div className="category-tabs" role="navigation" aria-label="Marktkategorien">
        <button className={cn(!category && "active")} aria-pressed={!category} onClick={() => updateFilters({ category: "" })}>Alle <span>{rows.length}</span></button>
        {(categories.data?.data ?? []).map((item) => <button className={cn(category === item.name && "active")} aria-pressed={category === item.name} key={item.name} onClick={() => updateFilters({ category: item.name })}><ItemIcon src={item.icon} name={item.name} size={24} />{item.name}<span>{rows.filter((row) => row.category === item.name).length}</span></button>)}
      </div>
      <Card>
        <div className="toolbar">
          <div className="field-group search-field"><FieldLabel htmlFor="market-search">Globale Suche</FieldLabel><div className="field-with-icon"><Search size={16} /><Input id="market-search" value={query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Item, Material oder Kategorie" /></div></div>
          <div className="field-group"><FieldLabel htmlFor="market-availability">Datenstatus</FieldLabel><Select id="market-availability" value={availability} onChange={(event) => updateFilters({ availability: event.target.value as MarketAvailability })}><option value="all">Alle Items</option><option value="tradable">Mit aktiven Aufträgen</option><option value="incomplete">Unvollständige Kurse</option></Select></div>
          <div className="field-group"><FieldLabel htmlFor="market-density">Darstellung</FieldLabel><Select id="market-density" value={density} onChange={(event) => updateFilters({ density: event.target.value === "compact" ? "compact" : "detailed" })}><option value="detailed">Ausführlich</option><option value="compact">Kompakt</option></Select></div>
          {(query || category || availability !== "all") ? <Button variant="ghost" onClick={clear}><SlidersHorizontal size={16} /> Zurücksetzen</Button> : null}
          <span className="toolbar-summary">{filtered.length} von {rows.length} Items</span>
        </div>
        {filtered.length === 0 ? <div className="p-4"><EmptyState title="Keine Marktitems gefunden" description="Für diese Kombination aus Suche, Kategorie und Datenstatus gibt es keine Treffer." action={<Button onClick={clear}>Filter zurücksetzen</Button>} /></div> : (
          <>
            <div className="data-table-wrap desktop-table"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => { const meta = header.column.columnDef.meta as { numeric?: boolean } | undefined; return <th key={header.id} scope="col" aria-sort={header.column.getCanSort() ? ariaSort(header.column.getIsSorted()) : undefined} className={meta?.numeric ? "numeric" : undefined}>{header.column.getCanSort() ? <button className="sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<SortIcon state={header.column.getIsSorted()} /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>; })}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => { const meta = cell.column.columnDef.meta as { numeric?: boolean } | undefined; return <td key={cell.id} className={meta?.numeric ? "numeric" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>; })}</tr>)}</tbody></table></div>
            <div className="mobile-card-list">{table.getRowModel().rows.map((row) => <MarketCard key={row.original.material} row={row.original} />)}</div>
            <MarketPagination table={table} />
          </>
        )}
      </Card>
      <p className="method-note">Absoluter Spread = höherer Preis minus niedrigerer Preis. Relativer Spread = absoluter Spread geteilt durch den niedrigeren Preis. Ein API-Wert von 0 bei gleichzeitig 0 aktiven Aufträgen wird als fehlender Kurs behandelt.</p>
    </>
  );
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  return state === "asc" ? <ArrowUp size={12} /> : state === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />;
}

function ariaSort(state: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  return state === "asc" ? "ascending" : state === "desc" ? "descending" : "none";
}

function MarketCard({ row }: { row: MarketRow }) {
  const favorites = useFavorites();
  return <article className="mobile-data-card"><div className="mobile-data-card-header"><ItemIcon src={row.icon} name={row.name} size={44} /><div className="mobile-data-card-main"><Link href={`/market/${encodeURIComponent(row.material)}`}><strong>{row.name}</strong><small>{row.material}</small></Link><Badge>{row.category}</Badge></div><Button size="icon" variant="ghost" onClick={() => favorites.toggleMarket(row.material)} aria-label="Favorit umschalten"><Heart size={16} fill={favorites.isMarketFavorite(row.material) ? "currentColor" : "none"} /></Button></div><div className="mobile-data-values"><div className="mobile-data-value"><span>Kaufkurs (BUY)</span><strong><PriceValue value={row.buyPrice} /></strong></div><div className="mobile-data-value"><span>Verkaufskurs (SELL)</span><strong><PriceValue value={row.sellPrice} /></strong></div><div className="mobile-data-value"><span>Spread</span><strong><PriceValue value={row.spread} /></strong></div><div className="mobile-data-value"><span>Aufträge</span><strong>{row.buyOrders} / {row.sellOrders}</strong></div></div><div className="mobile-data-actions"><LinkButton href={`/market/${encodeURIComponent(row.material)}`} variant="primary" size="sm">Item analysieren</LinkButton></div></article>;
}

function MarketPagination({ table }: { table: ReturnType<typeof useReactTable<MarketRow>> }) {
  return <div className="pagination"><span>Seite {table.getState().pagination.pageIndex + 1} von {Math.max(1, table.getPageCount())}</span><div className="pagination-actions"><Button size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft size={15} /> Zurück</Button><Button size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Weiter <ChevronRight size={15} /></Button></div></div>;
}
