"use client";

import { Braces, Check, Clipboard, Clock3, Play, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { formatDuration } from "@/lib/format";
import { copyToClipboard } from "@/lib/utils";

type ExplorerEndpoint = {
  id: string;
  label: string;
  publicPath: string;
  proxyPath: string;
  parameter?: "material" | "category";
  defaultParameter?: string;
};

const endpoints: ExplorerEndpoint[] = [
  { id: "auctions", label: "Aktive Auktionen", publicPath: "/auctions/active", proxyPath: "/api/opsucht/auctions", parameter: "category" },
  { id: "auction-categories", label: "Auktionskategorien", publicPath: "/auctions/categories", proxyPath: "/api/opsucht/auction-categories" },
  { id: "market-categories", label: "Marktkategorien", publicPath: "/market/categories", proxyPath: "/api/opsucht/market/categories" },
  { id: "market-items", label: "Marktitems", publicPath: "/market/items", proxyPath: "/api/opsucht/market/items" },
  { id: "market-prices", label: "Alle Marktpreise", publicPath: "/market/prices", proxyPath: "/api/opsucht/market/prices" },
  { id: "market-price", label: "Preis eines Items", publicPath: "/market/price/{material}", proxyPath: "/api/opsucht/market/price", parameter: "material", defaultParameter: "ACACIA_LEAVES" },
  { id: "market-history", label: "Preisverlauf eines Items", publicPath: "/market/history/{material}", proxyPath: "/api/opsucht/market/history", parameter: "material", defaultParameter: "ACACIA_LEAVES" },
  { id: "merchant", label: "Händlerkurse", publicPath: "/merchant/rates", proxyPath: "/api/opsucht/merchant/rates" },
];

interface ExplorerResponse {
  status: number;
  responseTimeMs: number;
  body: unknown;
  requestedUrl: string;
}

export function ApiExplorerDashboard() {
  const [endpointId, setEndpointId] = useState(endpoints[0]!.id);
  const [parameter, setParameter] = useState("");
  const [response, setResponse] = useState<ExplorerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"formatted" | "tree">("formatted");
  const endpoint = endpoints.find((item) => item.id === endpointId) ?? endpoints[0]!;

  const resolvedParameter = parameter.trim() || endpoint.defaultParameter || "";
  const requestedUrl = useMemo(() => {
    if (endpoint.parameter === "material") return `${endpoint.proxyPath}/${encodeURIComponent(resolvedParameter)}`;
    if (endpoint.parameter === "category" && resolvedParameter) return `${endpoint.proxyPath}?category=${encodeURIComponent(resolvedParameter)}`;
    return endpoint.proxyPath;
  }, [endpoint, resolvedParameter]);

  const publicUrl = endpoint.publicPath.replace("{material}", resolvedParameter || "{material}") + (endpoint.parameter === "category" && resolvedParameter ? `?category=${encodeURIComponent(resolvedParameter)}` : "");

  const execute = async () => {
    if (endpoint.parameter === "material" && !resolvedParameter) return;
    setLoading(true);
    const startedAt = performance.now();
    try {
      const result = await fetch(requestedUrl, { headers: { Accept: "application/json" } });
      let body: unknown;
      try { body = await result.json(); } catch { body = { error: { message: "Leere oder nicht lesbare Antwort" } }; }
      setResponse({ status: result.status, responseTimeMs: Math.round(performance.now() - startedAt), body, requestedUrl });
    } catch {
      setResponse({ status: 0, responseTimeMs: Math.round(performance.now() - startedAt), body: { error: { message: "Die Anfrage konnte nicht ausgeführt werden." } }, requestedUrl });
    } finally {
      setLoading(false);
    }
  };

  const formatted = response ? JSON.stringify(response.body, null, 2) : "";
  const copy = async () => {
    if (await copyToClipboard(formatted)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Entwicklerwerkzeug" title="API-Explorer" description="Ausschließlich die acht bekannten öffentlichen GET-Endpunkte sicher und lesend untersuchen." actions={<Badge tone="success"><ShieldCheck size={13} /> Nur feste GET-Routen</Badge>} />
      <div className="explorer-grid">
        <Card className="explorer-controls">
          <CardHeader title="Anfrage" description="Ein frei konfigurierbarer Proxy ist absichtlich nicht verfügbar" />
          <div className="explorer-form">
            <div className="field-group"><FieldLabel htmlFor="explorer-endpoint">Endpunkt</FieldLabel><Select id="explorer-endpoint" value={endpointId} onChange={(event) => { const selected = endpoints.find((item) => item.id === event.target.value)!; setEndpointId(selected.id); setParameter(selected.defaultParameter ?? ""); setResponse(null); }}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></div>
            {endpoint.parameter ? <div className="field-group"><FieldLabel htmlFor="explorer-param">{endpoint.parameter === "material" ? "Materialname" : "Kategorie, optional"}</FieldLabel><Input id="explorer-param" value={parameter} onChange={(event) => setParameter(event.target.value)} placeholder={endpoint.parameter === "material" ? "z. B. DIAMOND" : "z. B. custom_items"} /></div> : null}
            <div className="request-preview"><span>Öffentliche Zielroute</span><code>GET https://api.opsucht.net{publicUrl}</code></div>
            <Button variant="primary" onClick={execute} disabled={loading || (endpoint.parameter === "material" && !resolvedParameter)}>{loading ? <Clock3 className="spin" size={16} /> : <Play size={16} />}{loading ? "Anfrage läuft" : "Anfrage ausführen"}</Button>
          </div>
        </Card>

        <Card className="explorer-response">
          <CardHeader title="Antwort" description={response ? response.requestedUrl : "Noch keine Anfrage ausgeführt"} action={response ? <div className="response-meta"><Badge tone={response.status >= 200 && response.status < 300 ? "success" : "danger"}>HTTP {response.status || "Fehler"}</Badge><Badge><Clock3 size={12} /> {formatDuration(response.responseTimeMs)}</Badge></div> : undefined} />
          {!response ? <EmptyState title="Bereit für eine Anfrage" description="Wähle einen Endpunkt und führe eine erlaubte GET-Anfrage aus. Die Antwort erscheint hier formatiert und als Baum." /> : <>
            <div className="response-toolbar"><div className="view-toggle"><button className={mode === "formatted" ? "active" : undefined} aria-pressed={mode === "formatted"} onClick={() => setMode("formatted")} aria-label="Formatiertes JSON"><Braces size={16} /></button><button className={mode === "tree" ? "active" : undefined} aria-pressed={mode === "tree"} onClick={() => setMode("tree")} aria-label="JSON-Baum">⌘</button></div><Button size="sm" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Kopiert" : "Antwort kopieren"}</Button></div>
            {mode === "formatted" ? <pre className="json-output">{formatted}</pre> : <div className="json-tree"><TreeNode label="response" value={response.body} depth={0} /></div>}
          </>}
        </Card>
      </div>
    </>
  );
}

function TreeNode({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (value === null || typeof value !== "object") {
    return <div className="tree-leaf"><span>{label}</span><code className={`json-${typeof value}`}>{JSON.stringify(value)}</code></div>;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const visible = entries.slice(0, 200);
  return (
    <div className="tree-node">
      <button onClick={() => setOpen((current) => !current)} aria-expanded={open}><span>{open ? "−" : "+"}</span><strong>{label}</strong><small>{Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`}</small></button>
      {open ? <div className="tree-children">{visible.map(([key, child]) => <TreeNode key={key} label={key} value={child} depth={depth + 1} />)}{entries.length > visible.length ? <p className="tree-limit">{entries.length - visible.length} weitere Einträge. Die vollständige Antwort bleibt in der JSON-Ansicht verfügbar.</p> : null}</div> : null}
    </div>
  );
}
