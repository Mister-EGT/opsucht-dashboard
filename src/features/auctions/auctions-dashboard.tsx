"use client";

/* eslint-disable react-hooks/incompatible-library */

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Copy, Eye, FilterX, Grid2X2, Heart, List, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuctionDialog } from "@/features/auctions/auction-dialog";
import { useAuctionCategories, useAuctions } from "@/hooks/use-opsucht";
import { useFavorites } from "@/components/favorites-provider";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { PriceValue } from "@/components/price-value";
import { PageHeader } from "@/components/page-header";
import { RefreshButton } from "@/components/refresh-button";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { auctionFilterHref, parseAuctionFilters } from "@/lib/filter-url";
import { formatMaterialName, formatRelativeTime } from "@/lib/format";
import type { Auction } from "@/lib/schemas";
import { cn, copyToClipboard } from "@/lib/utils";

function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function AuctionsDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchKey = searchParams.toString();
  const [filters, setFilters] = useState(() => parseAuctionFilters(searchKey));
  const { query, category, minimum, maximum, soon, view } = filters;
  const [sorting, setSorting] = useState<SortingState>([{ id: "endTime", desc: false }]);
  const [selected, setSelected] = useState<Auction | null>(null);
  const now = useClock();
  const favorites = useFavorites();
  const { notify } = useToast();
  const auctions = useAuctions(category || undefined);
  const categories = useAuctionCategories();

  useEffect(() => {
    const next = parseAuctionFilters(searchKey);
    setFilters((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [searchKey]);

  const updateFilters = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    router.replace(auctionFilterHref(next), { scroll: false });
  };

  const copyMaterial = useCallback(async (material: string) => {
    const copied = await copyToClipboard(material);
    notify(copied ? "Materialname kopiert." : "Der Materialname konnte nicht kopiert werden.", copied ? "success" : "danger");
  }, [notify]);

  const categoryNames = useMemo(() => new Map((categories.data?.data ?? []).map((item) => [item.name, item.displayName])), [categories.data]);
  const filterNow = soon ? now : 0;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    const min = minimum === "" ? null : Number(minimum.replace(",", "."));
    const max = maximum === "" ? null : Number(maximum.replace(",", "."));
    return (auctions.data?.data ?? []).filter((auction) => {
      const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
      if (normalized && !`${name} ${auction.item.material} ${auction.category}`.toLocaleLowerCase("de-DE").includes(normalized)) return false;
      if (min !== null && Number.isFinite(min) && auction.currentBid < min) return false;
      if (max !== null && Number.isFinite(max) && auction.currentBid > max) return false;
      const remaining = new Date(auction.endTime).getTime() - filterNow;
      if (soon && (remaining <= 0 || remaining > 15 * 60_000)) return false;
      return true;
    });
  }, [auctions.data, query, minimum, maximum, soon, filterNow]);

  const columns = useMemo<ColumnDef<Auction>[]>(() => [
    {
      id: "favorite",
      header: () => <span className="sr-only">Favorit</span>,
      enableSorting: false,
      cell: ({ row }) => <Button size="icon" variant="ghost" onClick={() => favorites.toggleAuction(row.original)} aria-label={favorites.isAuctionFavorite(row.original.uid) ? "Aus Favoriten entfernen" : "Als Favorit speichern"}><Heart size={16} fill={favorites.isAuctionFavorite(row.original.uid) ? "currentColor" : "none"} /></Button>,
    },
    {
      id: "name",
      accessorFn: (auction) => auction.item.displayName ?? formatMaterialName(auction.item.material),
      header: "Item",
      cell: ({ row }) => {
        const item = row.original.item;
        const name = item.displayName ?? formatMaterialName(item.material);
        return <div className="item-cell"><ItemIcon src={item.icon} name={name} size={38} /><div><strong>{name}</strong><small>{item.material}</small></div></div>;
      },
    },
    { accessorKey: "category", header: "Kategorie", cell: ({ getValue }) => <Badge>{categoryNames.get(String(getValue())) ?? String(getValue())}</Badge> },
    { id: "amount", accessorFn: (auction) => auction.item.amount, header: "Menge", meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>()}×` },
    { accessorKey: "startBid", header: "Startgebot", meta: { numeric: true }, cell: ({ getValue }) => <PriceValue value={getValue<number>()} /> },
    { accessorKey: "currentBid", header: "Aktuelles Gebot", meta: { numeric: true }, cell: ({ getValue }) => <strong><PriceValue value={getValue<number>()} /></strong> },
    {
      accessorKey: "endTime",
      header: "Restzeit",
      sortingFn: "datetime",
      cell: ({ row }) => <Countdown endTime={row.original.endTime} now={now} />,
    },
    {
      id: "actions",
      header: "Aktionen",
      enableSorting: false,
      cell: ({ row }) => <div className="table-actions"><Button variant="ghost" size="icon" onClick={() => copyMaterial(row.original.item.material)} aria-label="Material kopieren"><Copy size={15} /></Button><Button variant="ghost" size="icon" onClick={() => setSelected(row.original)} aria-label="Auktionsdetails öffnen"><Eye size={16} /></Button></div>,
    },
  ], [categoryNames, favorites, now, copyMaterial]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const clearFilters = () => {
    updateFilters({ query: "", category: "", minimum: "", maximum: "", soon: false });
  };
  const hasFilters = Boolean(query || category || minimum || maximum || soon);

  if (auctions.isPending || categories.isPending) return <><PageHeader eyebrow="Live-Auktionen" title="Auktionshaus" description="Aktive Auktionen durchsuchen, sortieren und beobachten." /><PageSkeleton /></>;
  if (auctions.isError) return <><PageHeader eyebrow="Live-Auktionen" title="Auktionshaus" description="Aktive Auktionen durchsuchen, sortieren und beobachten." /><ErrorState message={auctions.error.message} onRetry={() => auctions.refetch()} /></>;

  return (
    <>
      <PageHeader eyebrow="Live-Auktionen" title="Auktionshaus" description="Alle öffentlich sichtbaren Auktionen mit Echtzeit-Restzeit, präzisen Filtern und lokalen Favoriten." actions={<><DataFreshness meta={auctions.data?.meta} fetching={auctions.isFetching} /><RefreshButton fetching={auctions.isFetching || categories.isFetching} onRefresh={() => { auctions.refetch(); categories.refetch(); }} /></>} />
      {auctions.data?.meta.stale ? <StaleBanner message={auctions.data.meta.error} /> : null}
      {categories.isError ? <StaleBanner message="Die lesbaren Kategorienamen sind vorübergehend nicht verfügbar. Auktionen und technische Kategorien bleiben nutzbar." /> : null}
      <Card>
        <div className="toolbar">
          <div className="field-group search-field"><FieldLabel htmlFor="auction-search">Suche</FieldLabel><div className="field-with-icon"><Search size={16} /><Input id="auction-search" value={query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Itemname oder Material" /></div></div>
          <div className="field-group"><FieldLabel htmlFor="auction-category">Kategorie</FieldLabel><Select id="auction-category" value={category} onChange={(event) => updateFilters({ category: event.target.value })}><option value="">Alle Kategorien</option>{(categories.data?.data ?? []).map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}</Select></div>
          <div className="field-group price-filter"><FieldLabel htmlFor="auction-min">Mindestpreis ($)</FieldLabel><Input id="auction-min" inputMode="decimal" value={minimum} onChange={(event) => updateFilters({ minimum: event.target.value })} placeholder="0" /></div>
          <div className="field-group price-filter"><FieldLabel htmlFor="auction-max">Höchstpreis ($)</FieldLabel><Input id="auction-max" inputMode="decimal" value={maximum} onChange={(event) => updateFilters({ maximum: event.target.value })} placeholder="Unbegrenzt" /></div>
          <label className="check-field"><input type="checkbox" checked={soon} onChange={(event) => updateFilters({ soon: event.target.checked })} /> Endet in 15 Min.</label>
          {hasFilters ? <Button variant="ghost" onClick={clearFilters}><FilterX size={16} /> Filter löschen</Button> : null}
          <div className="view-toggle" aria-label="Ansicht wählen"><button className={cn(view === "table" && "active")} aria-pressed={view === "table"} onClick={() => updateFilters({ view: "table" })} aria-label="Tabellenansicht"><List size={17} /></button><button className={cn(view === "cards" && "active")} aria-pressed={view === "cards"} onClick={() => updateFilters({ view: "cards" })} aria-label="Kartenansicht"><Grid2X2 size={17} /></button></div>
          <span className="toolbar-summary">{filtered.length} von {auctions.data?.data.length ?? 0} Auktionen</span>
        </div>

        {filtered.length === 0 ? <div className="p-4"><EmptyState title="Keine passenden Auktionen" description="Die aktuellen Auktionen erfüllen diese Filter nicht. Filter lassen sich jederzeit zurücksetzen." action={hasFilters ? <Button onClick={clearFilters}>Filter zurücksetzen</Button> : undefined} /></div> : view === "table" ? (
          <>
            <div className="data-table-wrap desktop-table"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => { const numeric = (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric; return <th key={header.id} scope="col" aria-sort={header.column.getCanSort() ? ariaSort(header.column.getIsSorted()) : undefined} className={numeric ? "numeric" : undefined}>{header.isPlaceholder ? null : header.column.getCanSort() ? <button className="sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<SortIcon state={header.column.getIsSorted()} /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>; })}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className={new Date(row.original.endTime).getTime() <= now ? "expired-row" : undefined}>{row.getVisibleCells().map((cell) => { const numeric = (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric; return <td key={cell.id} className={numeric ? "numeric" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>; })}</tr>)}</tbody></table></div>
            <div className="mobile-card-list">{table.getRowModel().rows.map((row) => <AuctionCard key={row.original.uid} auction={row.original} now={now} categoryName={categoryNames.get(row.original.category)} onOpen={() => setSelected(row.original)} />)}</div>
            <Pagination table={table} />
          </>
        ) : (
          <><div className="auction-card-grid">{table.getRowModel().rows.map((row) => <AuctionCard key={row.original.uid} auction={row.original} now={now} categoryName={categoryNames.get(row.original.category)} onOpen={() => setSelected(row.original)} />)}</div><Pagination table={table} /></>
        )}
      </Card>
      <AuctionDialog auction={selected} open={Boolean(selected)} onClose={() => setSelected(null)} categoryName={selected ? categoryNames.get(selected.category) : undefined} now={now} />
    </>
  );
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  return state === "asc" ? <ArrowUp size={12} /> : state === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />;
}

function ariaSort(state: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  return state === "asc" ? "ascending" : state === "desc" ? "descending" : "none";
}

function Countdown({ endTime, now }: { endTime: string; now: number }) {
  const expired = new Date(endTime).getTime() <= now;
  return <span title={new Date(endTime).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} className={expired ? "countdown expired" : "countdown"}><Clock3 size={13} />{expired ? "Beendet" : formatRelativeTime(endTime)}</span>;
}

function AuctionCard({ auction, now, categoryName, onOpen }: { auction: Auction; now: number; categoryName?: string; onOpen: () => void }) {
  const favorites = useFavorites();
  const { notify } = useToast();
  const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
  const expired = new Date(auction.endTime).getTime() <= now;
  return (
    <article className={cn("mobile-data-card auction-card", expired && "expired-card")}>
      <div className="mobile-data-card-header"><ItemIcon src={auction.item.icon} name={name} size={44} /><div className="mobile-data-card-main"><strong>{name}</strong><small>{auction.item.material}</small><Badge tone={expired ? "danger" : "neutral"}>{expired ? "Beendet" : categoryName ?? auction.category}</Badge></div><Button size="icon" variant="ghost" onClick={() => favorites.toggleAuction(auction)} aria-label="Favorit umschalten"><Heart size={16} fill={favorites.isAuctionFavorite(auction.uid) ? "currentColor" : "none"} /></Button></div>
      <div className="mobile-data-values"><div className="mobile-data-value"><span>Aktuelles Gebot</span><strong><PriceValue value={auction.currentBid} /></strong></div><div className="mobile-data-value"><span>Restzeit</span><strong>{expired ? "Beendet" : formatRelativeTime(auction.endTime)}</strong></div><div className="mobile-data-value"><span>Startgebot</span><strong><PriceValue value={auction.startBid} /></strong></div><div className="mobile-data-value"><span>Menge</span><strong>{auction.item.amount}×</strong></div></div>
      <div className="mobile-data-actions"><Button size="sm" onClick={async () => { const copied = await copyToClipboard(auction.item.material); notify(copied ? "Materialname kopiert." : "Der Materialname konnte nicht kopiert werden.", copied ? "success" : "danger"); }}><Copy size={14} /> Kopieren</Button><Button size="sm" variant="primary" onClick={onOpen}><Eye size={14} /> Details</Button></div>
    </article>
  );
}

function Pagination({ table }: { table: ReturnType<typeof useReactTable<Auction>> }) {
  return <div className="pagination"><span>Seite {table.getState().pagination.pageIndex + 1} von {Math.max(1, table.getPageCount())}</span><div className="pagination-actions"><Button size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Vorherige Seite"><ChevronLeft size={15} /> Zurück</Button><Button size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Weiter <ChevronRight size={15} /></Button></div></div>;
}
