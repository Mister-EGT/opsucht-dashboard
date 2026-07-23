"use client";

import { Activity, CheckCircle2, Clock3, Database, RefreshCw, Server, XCircle } from "lucide-react";
import { DataFreshness } from "@/components/data-freshness";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useApiHealth } from "@/hooks/use-opsucht";
import { formatDateTime, formatDuration, formatRelativeTime } from "@/lib/format";

export function StatusDashboard() {
  const health = useApiHealth();
  if (health.isPending) return <><PageHeader eyebrow="Diagnose" title="API-Status" description="Erreichbarkeit, Cache und Datenalter aller bekannten Endpunkte." /><PageSkeleton /></>;
  if (health.isError) return <><PageHeader eyebrow="Diagnose" title="API-Status" description="Erreichbarkeit, Cache und Datenalter aller bekannten Endpunkte." /><ErrorState message={health.error.message} onRetry={() => health.refetch()} /></>;

  const data = health.data;
  const failed = data.endpoints.filter((endpoint) => !endpoint.reachable).length;
  const stale = data.endpoints.filter((endpoint) => endpoint.stale).length;
  const average = data.endpoints.reduce((sum, endpoint) => sum + endpoint.responseTimeMs, 0) / Math.max(1, data.endpoints.length);

  return (
    <>
      <PageHeader eyebrow="Diagnose" title="API-Status" description="Jeder bekannte öffentliche OPSUCHT-Endpunkt wird über denselben validierten und begrenzten Proxy geprüft." actions={<><DataFreshness meta={{ key: "health", source: "live", stale: false, cachedAt: data.checkedAt, fetchedAt: data.checkedAt, lastSuccessAt: data.checkedAt, lastErrorAt: null, responseTimeMs: 0, upstreamStatus: 200, ageMs: 0, ttlMs: 15_000 }} fetching={health.isFetching} /><Button onClick={() => health.refetch()} disabled={health.isFetching}><RefreshCw size={16} className={health.isFetching ? "spin" : undefined} /> Neu prüfen</Button></>} />
      <div className="stat-grid">
        <MetricCard label="Erreichbare Endpunkte" value={`${data.healthy}/${data.total}`} note={failed ? `${failed} Bereiche melden einen Fehler` : "Alle bekannten Bereiche erreichbar"} icon={CheckCircle2} />
        <MetricCard label="Fehler" value={String(failed)} note="Ein Ausfall betrifft nur den jeweiligen Bereich" icon={XCircle} color="#c2414b" />
        <MetricCard label="Veraltete Caches" value={String(stale)} note="Fallback-Daten nach fehlgeschlagener Live-Anfrage" icon={Database} color="#f59e0b" />
        <MetricCard label="Letzte Netzantwort" value={formatDuration(average)} note="Mittel der gespeicherten Antwortzeiten" icon={Clock3} color="#8b5cf6" />
      </div>

      <Card className="mt-5">
        <CardHeader title="Bekannte öffentliche Endpunkte" description={`Letzte Gesamtprüfung ${formatRelativeTime(data.checkedAt)}`} action={<Badge tone={failed ? "warning" : "success"}><Activity size={13} /> {failed ? "Teilweise verfügbar" : "Betriebsbereit"}</Badge>} />
        <div className="status-list">
          {data.endpoints.map((endpoint) => (
            <article className="status-row" key={endpoint.key}>
              <span className={`status-service-icon ${endpoint.reachable ? "ok" : "error"}`}>{endpoint.reachable ? <CheckCircle2 size={19} /> : <XCircle size={19} />}</span>
              <div className="status-main"><div><strong>{endpoint.label}</strong><Badge tone={endpoint.reachable ? "success" : "danger"}>{endpoint.reachable ? "Erreichbar" : "Nicht erreichbar"}</Badge>{endpoint.stale ? <Badge tone="warning">Veraltet</Badge> : null}</div><code>GET {endpoint.path}</code><p>{endpoint.message}</p></div>
              <dl className="status-metrics">
                <div><dt>HTTP</dt><dd>{endpoint.status || "Keine Antwort"}</dd></div>
                <div><dt>Antwortzeit</dt><dd>{formatDuration(endpoint.responseTimeMs)}</dd></div>
                <div><dt>Cache</dt><dd>{endpoint.cacheStatus === "live" ? "Live" : endpoint.cacheStatus === "cache" ? "Servercache" : "Kein Cache"}</dd></div>
                <div><dt>Datenalter</dt><dd>{formatDuration(endpoint.dataAgeMs)}</dd></div>
                <div><dt>Letzter Erfolg</dt><dd title={formatDateTime(endpoint.lastSuccessAt)}>{endpoint.lastSuccessAt ? formatRelativeTime(endpoint.lastSuccessAt) : "Noch keiner"}</dd></div>
                <div><dt>Letzter Fehler</dt><dd title={formatDateTime(endpoint.lastErrorAt)}>{endpoint.lastErrorAt ? formatRelativeTime(endpoint.lastErrorAt) : "Keiner erfasst"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </Card>
      <div className="security-note"><Server size={18} /><div><strong>Sicherer Diagnoseumfang</strong><p>Die Statusseite veröffentlicht ausschließlich fachliche Zustandsinformationen. Stacktraces, Serverpfade und interne Fehlerdetails bleiben serverseitig.</p></div></div>
    </>
  );
}
