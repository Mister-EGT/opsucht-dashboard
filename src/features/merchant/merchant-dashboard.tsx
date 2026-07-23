"use client";

/* eslint-disable react-hooks/incompatible-library */

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Calculator, Code2, Heart, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";
import { DataFreshness } from "@/components/data-freshness";
import { ItemIcon } from "@/components/item-icon";
import { PageHeader } from "@/components/page-header";
import { RefreshButton } from "@/components/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageSkeleton, StaleBanner } from "@/components/ui/states";
import { useMerchantRates } from "@/hooks/use-opsucht";
import { merchantFilterHref, parseMerchantQuery } from "@/lib/filter-url";
import { formatEconomyValue, formatExactValue, formatMaterialName, formatPercentNumber, formatSignedPercentNumber } from "@/lib/format";
import { calculateRequiredItems, calculateShardValue, normalizeMerchantRates, normalizeWholeItemQuantity } from "@/lib/merchant";
import type { ParsedMerchantRate } from "@/lib/types";

export function MerchantDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchKey = searchParams.toString();
  const ratesQuery = useMerchantRates();
  const favorites = useFavorites();
  const [query, setQuery] = useState(() => parseMerchantQuery(searchKey));
  const [sorting, setSorting] = useState<SortingState>([{ id: "displayName", desc: false }]);
  const [selected, setSelected] = useState<ParsedMerchantRate | null>(null);
  const rates = useMemo(() => normalizeMerchantRates(ratesQuery.data?.data ?? []), [ratesQuery.data]);
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  const filtered = rates.filter((rate) => `${rate.displayName} ${rate.material} ${rate.materialKey} ${rate.target}`.toLocaleLowerCase("de-DE").includes(normalized));

  useEffect(() => {
    const next = parseMerchantQuery(searchKey);
    setQuery((current) => current === next ? current : next);
  }, [searchKey]);

  const updateQuery = (value: string) => {
    setQuery(value);
    router.replace(merchantFilterHref(value), { scroll: false });
  };

  const columns = useMemo<ColumnDef<ParsedMerchantRate>[]>(() => [
    { id: "favorite", header: () => <span className="sr-only">Favorit</span>, enableSorting: false, cell: ({ row }) => <Button size="icon" variant="ghost" onClick={() => favorites.toggleMerchant(row.original.id)} aria-label="Favorit umschalten"><Heart size={16} fill={favorites.isMerchantFavorite(row.original.id) ? "currentColor" : "none"} /></Button> },
    { accessorKey: "displayName", header: "Item", cell: ({ row }) => <div className="item-cell"><ItemIcon name={row.original.displayName} size={38} /><div><strong>{row.original.displayName}</strong><small>{row.original.material}</small></div></div> },
    { accessorKey: "customName", header: "Custom-Item", cell: ({ row }) => row.original.isCustom ? <Badge tone="accent">{row.original.customName}</Badge> : <span className="muted-value">Standardmaterial</span> },
    { accessorKey: "target", header: "Zielwährung", cell: ({ getValue }) => <Badge tone="info">{formatMaterialName(String(getValue()))}</Badge> },
    { accessorKey: "base", header: "Basiswert", meta: { numeric: true }, cell: ({ getValue }) => formatEconomyValue(getValue<number>()) },
    { accessorKey: "exchangeRate", header: "Wechselkurs", meta: { numeric: true }, cell: ({ getValue }) => <strong>{formatEconomyValue(getValue<number>())}</strong> },
    { accessorKey: "deviation", header: "Abweichung", meta: { numeric: true }, cell: ({ row }) => <span className={row.original.deviation >= 0 ? "positive-value" : "negative-value"}>{row.original.deviation >= 0 ? "+" : ""}{formatEconomyValue(row.original.deviation)}</span> },
    { id: "deviationPercent", accessorFn: (row) => row.deviationPercent ?? undefined, header: "Abweichung %", meta: { numeric: true }, sortUndefined: "last", cell: ({ row }) => <span className={row.original.deviation >= 0 ? "positive-value" : "negative-value"}>{formatSignedPercentNumber(row.original.deviationPercent)}</span> },
    { id: "customModelData", accessorFn: (row) => row.customModelData ?? undefined, header: "Custom Model Data", meta: { numeric: true }, sortUndefined: "last", cell: ({ getValue }) => getValue<number | undefined>() ?? "Nicht vorhanden" },
    { id: "details", header: "Details", enableSorting: false, cell: ({ row }) => <Button variant="ghost" size="icon" onClick={() => setSelected(row.original)} aria-label="Technische Details"><Code2 size={16} /></Button> },
  ], [favorites]);

  const table = useReactTable({ data: filtered, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  if (ratesQuery.isPending) return <><PageHeader eyebrow="OPShards" title="Händler und Wechselkurse" description="Aktuelle Rohstoffhändler-Kurse und Custom-Items." /><PageSkeleton /></>;
  if (ratesQuery.isError) return <><PageHeader eyebrow="OPShards" title="Händler und Wechselkurse" description="Aktuelle Rohstoffhändler-Kurse und Custom-Items." /><ErrorState message={ratesQuery.error.message} onRetry={() => ratesQuery.refetch()} /></>;

  return (
    <>
      <PageHeader eyebrow="OPShards" title="Händler und Wechselkurse" description="Komplexe Minecraft-Komponenten werden lesbar aufbereitet, während der unveränderte Rohwert in der Technikansicht erhalten bleibt." actions={<><DataFreshness meta={ratesQuery.data?.meta} fetching={ratesQuery.isFetching} /><RefreshButton fetching={ratesQuery.isFetching} onRefresh={() => { ratesQuery.refetch(); }} /></>} />
      {ratesQuery.data?.meta.stale ? <StaleBanner message={ratesQuery.data.meta.error} /> : null}
      <MerchantCalculator rates={rates} />
      <Card className="mt-5">
        <div className="toolbar"><div className="field-group search-field"><FieldLabel htmlFor="merchant-search">Händleritem suchen</FieldLabel><div className="field-with-icon"><Search size={16} /><Input id="merchant-search" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Itemname, Material oder Zielwährung" /></div></div><span className="toolbar-summary">{filtered.length} von {rates.length} Kursen</span></div>
        {filtered.length === 0 ? <div className="p-4"><EmptyState title="Kein Händleritem gefunden" description="Der Suchbegriff passt zu keinem aktuellen Händlerkurs." action={<Button onClick={() => updateQuery("")}>Suche löschen</Button>} /></div> : <><div className="data-table-wrap desktop-table"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => { const numeric = (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric; return <th key={header.id} scope="col" aria-sort={header.column.getCanSort() ? ariaSort(header.column.getIsSorted()) : undefined} className={numeric ? "numeric" : undefined}>{header.column.getCanSort() ? <button className="sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<SortIcon state={header.column.getIsSorted()} /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>; })}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => { const numeric = (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric; return <td key={cell.id} className={numeric ? "numeric" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>; })}</tr>)}</tbody></table></div><div className="mobile-card-list">{table.getRowModel().rows.map((row) => <MerchantCard key={row.original.id} rate={row.original} onDetails={() => setSelected(row.original)} />)}</div></>}
      </Card>
      <MerchantDetails rate={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}

function MerchantCalculator({ rates }: { rates: ParsedMerchantRate[] }) {
  const [selectedId, setSelectedId] = useState(rates[0]?.id ?? "");
  const [quantity, setQuantity] = useState("64");
  const [desiredShards, setDesiredShards] = useState("1000");
  const selected = rates.find((rate) => rate.id === selectedId) ?? rates[0];
  if (!selected) return null;
  const numericQuantity = normalizeWholeItemQuantity(quantity);
  const shards = calculateShardValue(numericQuantity, selected.exchangeRate);
  const desired = Math.max(0, Number(desiredShards.replace(",", ".")) || 0);
  const required = calculateRequiredItems(desired, selected.exchangeRate);
  const produced = required.wholeItems === null ? null : calculateShardValue(required.wholeItems, selected.exchangeRate);

  return (
    <Card>
      <CardHeader title="OPShards-Rechner" description="Vorwärts- und Rückwärtsrechnung mit dem aktuellen Händlerkurs" action={<Badge tone="accent"><Calculator size={13} /> Live-Kurs</Badge>} />
      <div className="merchant-calculator">
        <div className="calculator-inputs">
          <div className="field-group"><FieldLabel htmlFor="merchant-item">Item</FieldLabel><Select id="merchant-item" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{rates.map((rate) => <option key={rate.id} value={rate.id}>{rate.displayName} · {formatEconomyValue(rate.exchangeRate)} OPShards</option>)}</Select></div>
          <div className="field-group"><FieldLabel htmlFor="merchant-quantity">Ganze Itemmenge</FieldLabel><Input id="merchant-quantity" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div className="calculator-result"><span>Erwarteter Händlerwert</span><strong>{formatEconomyValue(shards)} OPShards</strong><small>Exakt: {formatExactValue(shards)} OPShards</small></div>
        </div>
        <div className="calculator-divider" />
        <div className="calculator-inputs">
          <div className="field-group"><FieldLabel htmlFor="desired-shards">Gewünschte OPShards</FieldLabel><Input id="desired-shards" inputMode="decimal" value={desiredShards} onChange={(event) => setDesiredShards(event.target.value)} /></div>
          <div className="calculator-result"><span>Benötigte Itemmenge</span><strong>{required.wholeItems === null ? "Nicht berechenbar" : `${required.wholeItems} ganze Items`}</strong><small>Mathematisch exakt: {required.exact === null ? "Nicht verfügbar" : formatExactValue(required.exact)} Items</small></div>
          <div className="calculator-result"><span>Wert nach Aufrundung</span><strong>{produced === null ? "Nicht verfügbar" : `${formatEconomyValue(produced)} OPShards`}</strong><small>{produced === null ? "" : `${formatEconomyValue(produced - desired)} über dem Zielwert`}</small></div>
        </div>
      </div>
      <p className="calculator-rule">Minecraft-Items werden bei der Rückwärtsrechnung immer auf die nächste ganze Itemmenge aufgerundet. Die API dokumentiert keine weitere serverseitige Rundungsregel, daher wird der exakte mathematische Kurswert zusätzlich ausgewiesen.</p>
    </Card>
  );
}

function MerchantCard({ rate, onDetails }: { rate: ParsedMerchantRate; onDetails: () => void }) {
  const favorites = useFavorites();
  return <article className="mobile-data-card"><div className="mobile-data-card-header"><ItemIcon name={rate.displayName} size={44} /><div className="mobile-data-card-main"><strong>{rate.displayName}</strong><small>{rate.materialKey}</small>{rate.isCustom ? <Badge tone="accent">Custom-Item</Badge> : <Badge>Standardmaterial</Badge>}</div><Button size="icon" variant="ghost" onClick={() => favorites.toggleMerchant(rate.id)} aria-label="Favorit umschalten"><Heart size={16} fill={favorites.isMerchantFavorite(rate.id) ? "currentColor" : "none"} /></Button></div><div className="mobile-data-values"><div className="mobile-data-value"><span>Wechselkurs</span><strong>{formatEconomyValue(rate.exchangeRate)}</strong></div><div className="mobile-data-value"><span>Basiswert</span><strong>{formatEconomyValue(rate.base)}</strong></div><div className="mobile-data-value"><span>Abweichung</span><strong className={rate.deviation >= 0 ? "positive-value" : "negative-value"}>{formatPercentNumber(rate.deviationPercent)}</strong></div><div className="mobile-data-value"><span>Custom Model Data</span><strong>{rate.customModelData ?? "Keine"}</strong></div></div><div className="mobile-data-actions"><Button size="sm" onClick={onDetails}><Code2 size={14} /> Technikansicht</Button></div></article>;
}

function MerchantDetails({ rate, open, onClose }: { rate: ParsedMerchantRate | null; open: boolean; onClose: () => void }) {
  if (!rate) return null;
  return <Dialog open={open} onClose={onClose} title={rate.displayName} description="Technische Quelldaten des Händlerkurses" wide><dl className="detail-grid"><div className="detail-pair"><dt>Grundmaterial</dt><dd>{rate.material}</dd></div><div className="detail-pair"><dt>Normalisierter Schlüssel</dt><dd>{rate.materialKey}</dd></div><div className="detail-pair"><dt>Custom-Name</dt><dd>{rate.customName ?? "Nicht vorhanden"}</dd></div><div className="detail-pair"><dt>Custom Model Data</dt><dd>{rate.customModelData ?? "Nicht vorhanden"}</dd></div></dl><div className="dialog-section"><h3>Unveränderter API-Quellwert</h3><pre className="code-block">{rate.rawSource}</pre></div></Dialog>;
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) { return state === "asc" ? <ArrowUp size={12} /> : state === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />; }

function ariaSort(state: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  return state === "asc" ? "ascending" : state === "desc" ? "descending" : "none";
}
