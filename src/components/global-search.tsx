"use client";

import Link from "next/link";
import { Command, Gavel, History, RefreshCw, Search, Store, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { ItemIcon } from "@/components/item-icon";
import { useAuctions, useMarketItems, useMarketPrices, useMerchantRates } from "@/hooks/use-opsucht";
import { flattenMarketPrices } from "@/lib/market";
import { normalizeMerchantRates } from "@/lib/merchant";
import { PriceValue } from "@/components/price-value";
import { formatEconomyValue, formatMaterialName } from "@/lib/format";
import { useRecentMarketItems } from "@/hooks/use-recent-market-items";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  const shouldSearch = open && normalized.length >= 2;
  const auctions = useAuctions(undefined, shouldSearch);
  const prices = useMarketPrices(shouldSearch);
  const items = useMarketItems(shouldSearch);
  const merchants = useMerchantRates(shouldSearch);
  const recent = useRecentMarketItems();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    if (normalized.length < 2) return { market: [], merchant: [], auctions: [] };
    const marketRows = prices.data ? flattenMarketPrices(prices.data.data, items.data?.data ?? []) : [];
    return {
      market: marketRows.filter((item) => `${item.name} ${item.material} ${item.category}`.toLocaleLowerCase("de-DE").includes(normalized)).slice(0, 6),
      merchant: normalizeMerchantRates(merchants.data?.data ?? []).filter((item) => `${item.displayName} ${item.materialKey}`.toLocaleLowerCase("de-DE").includes(normalized)).slice(0, 5),
      auctions: (auctions.data?.data ?? []).filter((auction) => `${auction.item.displayName ?? ""} ${auction.item.material}`.toLocaleLowerCase("de-DE").includes(normalized)).slice(0, 6),
    };
  }, [normalized, prices.data, items.data, merchants.data, auctions.data]);

  const total = results.market.length + results.merchant.length + results.auctions.length;
  const loading = shouldSearch && (auctions.isPending || prices.isPending || items.isPending || merchants.isPending);
  const partiallyUnavailable = auctions.isError || prices.isError || items.isError || merchants.isError;
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button className="global-search-trigger" onClick={() => setOpen(true)} aria-label="Globale Suche öffnen">
        <Search size={17} aria-hidden="true" />
        <span>Items und Auktionen suchen</span>
        <kbd><Command size={12} aria-hidden="true" />K</kbd>
      </button>
      <Dialog open={open} onClose={close} title="Globale Suche" description="Marktitems, Händlerkurse und aktive Auktionen durchsuchen" wide>
        <div className="search-input-wrap">
          <Search size={18} aria-hidden="true" />
          <Input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mindestens zwei Zeichen eingeben" aria-label="Suchbegriff" />
        </div>
        {normalized.length < 2 ? recent.hydrated && recent.items.length ? (
          <div className="global-results recent-results">
            <section className="search-group">
              <div className="search-group-heading"><h3><History size={15} aria-hidden="true" />Zuletzt angesehen</h3><Button variant="ghost" size="sm" onClick={recent.clear}><Trash2 size={13} /> Verlauf löschen</Button></div>
              {recent.items.map((item) => (
                <Link key={item.material} href={`/market/${encodeURIComponent(item.material)}`} onClick={close} className="search-result">
                  <ItemIcon src={item.icon} name={item.name} size={34} />
                  <span><strong>{item.name}</strong><small>{item.category ? `${item.category} · ` : ""}{item.material}</small></span>
                </Link>
              ))}
            </section>
          </div>
        ) : (
          <div className="search-hint"><Search size={24} aria-hidden="true" /><p>Suche nach einem Anzeigenamen, Material oder einer Kategorie. Zuletzt geöffnete Items erscheinen künftig hier.</p></div>
        ) : loading && total === 0 ? (
          <div className="search-hint" role="status"><RefreshCw className="spin" size={24} aria-hidden="true" /><p>Die Suchdaten werden geladen.</p></div>
        ) : total === 0 ? (
          <div className="search-hint"><Search size={24} aria-hidden="true" /><p>{partiallyUnavailable ? "Keine Treffer in den verfügbaren Daten. Mindestens ein Suchbereich konnte nicht geladen werden." : "Keine passenden Ergebnisse gefunden."}</p></div>
        ) : (
          <div className="global-results">
            {loading ? <div className="search-loading-inline" role="status"><RefreshCw className="spin" size={14} /> Weitere Suchbereiche werden geladen.</div> : null}
            {results.market.length ? <SearchGroup title="Markt" icon={Store}>{results.market.map((item) => (
              <Link key={item.material} href={`/market/${encodeURIComponent(item.material)}`} onClick={close} className="search-result">
                <ItemIcon src={item.icon} name={item.name} size={34} />
                <span><strong>{item.name}</strong><small>{item.category} · BUY <PriceValue value={item.buyPrice} /></small></span>
              </Link>
            ))}</SearchGroup> : null}
            {results.merchant.length ? <SearchGroup title="Händler" icon={Tag}>{results.merchant.map((item) => (
              <Link key={item.id} href={`/merchant?q=${encodeURIComponent(item.displayName)}`} onClick={close} className="search-result">
                <ItemIcon name={item.displayName} size={34} />
                <span><strong>{item.displayName}</strong><small>{item.materialKey} · {formatEconomyValue(item.exchangeRate)} OPShards</small></span>
              </Link>
            ))}</SearchGroup> : null}
            {results.auctions.length ? <SearchGroup title="Auktionen" icon={Gavel}>{results.auctions.map((auction) => {
              const name = auction.item.displayName ?? formatMaterialName(auction.item.material);
              return (
                <Link key={auction.uid} href={`/auctions?q=${encodeURIComponent(name)}`} onClick={close} className="search-result">
                  <ItemIcon src={auction.item.icon} name={name} size={34} />
                  <span><strong>{name}</strong><small>{auction.item.amount} Stück · <PriceValue value={auction.currentBid} /></small></span>
                </Link>
              );
            })}</SearchGroup> : null}
          </div>
        )}
      </Dialog>
    </>
  );
}

function SearchGroup({ title, icon: Icon, children }: { title: string; icon: typeof Store; children: React.ReactNode }) {
  return <section className="search-group"><h3><Icon size={15} aria-hidden="true" />{title}</h3>{children}</section>;
}
