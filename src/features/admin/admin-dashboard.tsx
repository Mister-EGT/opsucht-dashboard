"use client";

import {
  Activity,
  BarChart3,
  Cloud,
  Download,
  Eye,
  Gauge,
  History,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAccount } from "@/components/account-provider";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { invokeAccountManagement } from "@/lib/account-management";
import {
  adminAuditSchema,
  adminAuditToCsv,
  adminSummarySchema,
  adminUsersToCsv,
  adminUserSchema,
  downloadTextFile,
  filterAdminAudit,
  filterAdminUsers,
  type AdminAttentionFilter,
  type AdminAudit,
  type AdminSummary,
  type AdminUser,
} from "@/lib/account";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format";

interface AccessDraft {
  role: "user" | "admin";
  status: "active" | "suspended";
}

type RoleFilter = "all" | "user" | "admin";
type StatusFilter = "all" | "active" | "suspended";

export function AdminDashboard() {
  const account = useAccount();
  const { notify } = useToast();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AccessDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<AdminAttentionFilter>("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AdminAudit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account.supabase || account.access?.role !== "admin" || account.access.status !== "active") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [summaryResult, usersResult, auditResult] = await Promise.all([
      account.supabase.rpc("admin_dashboard"),
      account.supabase.rpc("admin_list_users_v3"),
      account.supabase.rpc("admin_list_audit", { p_limit: 250 }),
    ]);
    const requestError = summaryResult.error ?? usersResult.error ?? auditResult.error;
    const parsedSummary = adminSummarySchema.safeParse(summaryResult.data);
    const parsedUsers = adminUserSchema.array().safeParse(usersResult.data);
    const parsedAudit = adminAuditSchema.array().safeParse(auditResult.data);
    if (requestError || !parsedSummary.success || !parsedUsers.success || !parsedAudit.success) {
      setError("Die administrativen Daten konnten nicht vollständig und sicher geladen werden.");
      setLoading(false);
      return;
    }
    setSummary(parsedSummary.data);
    setUsers(parsedUsers.data);
    setAudit(parsedAudit.data);
    setDrafts(Object.fromEntries(parsedUsers.data.map((user) => [user.user_id, { role: user.role, status: user.status }])));
    setSelectedUser((current) => current ? parsedUsers.data.find((user) => user.user_id === current.user_id) ?? null : null);
    setLoading(false);
  }, [account.access, account.supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const filteredUsers = useMemo(
    () => filterAdminUsers(users, query, roleFilter, statusFilter, attentionFilter),
    [attentionFilter, query, roleFilter, statusFilter, users],
  );
  const auditActions = useMemo(() => [...new Set(audit.map((entry) => entry.action))].sort(), [audit]);
  const filteredAudit = useMemo(
    () => filterAdminAudit(audit, auditQuery, auditAction),
    [audit, auditAction, auditQuery],
  );
  const topUsers = useMemo(
    () => [...users].filter((user) => user.favorites_count > 0).sort((a, b) => b.favorites_count - a.favorites_count).slice(0, 5),
    [users],
  );

  async function saveAccess(user: AdminUser) {
    if (!account.supabase) return;
    const draft = drafts[user.user_id];
    if (!draft) return;
    setSaving(user.user_id);
    const { error: updateError } = await account.supabase.rpc("admin_set_user_access", {
      p_user_id: user.user_id,
      p_role: draft.role,
      p_status: draft.status,
    });
    setSaving(null);
    notify(updateError ? "Kontozugriff konnte nicht geändert werden." : "Kontozugriff aktualisiert.", updateError ? "danger" : "success");
    if (!updateError) await load();
  }

  async function updateSetting(key: "cloud_favorites_enabled" | "profile_updates_enabled", value: boolean) {
    if (!account.supabase) return;
    setSaving(key);
    const { error: updateError } = await account.supabase.rpc("admin_update_setting", { p_key: key, p_value: value });
    if (!updateError) await Promise.all([account.refreshAccount(), load()]);
    setSaving(null);
    notify(updateError ? "Einstellung konnte nicht geändert werden." : "Einstellung gespeichert.", updateError ? "danger" : "success");
  }

  function exportUsers() {
    downloadTextFile(`opsucht-konten-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${adminUsersToCsv(filteredUsers)}`, "text/csv;charset=utf-8");
    notify(`${filteredUsers.length} Konten wurden als CSV exportiert.`, "success");
  }

  function exportAudit() {
    downloadTextFile(`opsucht-adminprotokoll-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${adminAuditToCsv(filteredAudit)}`, "text/csv;charset=utf-8");
    notify(`${filteredAudit.length} Protokolleinträge wurden als CSV exportiert.`, "success");
  }

  function showAttention(filter: AdminAttentionFilter) {
    setAttentionFilter(filter);
    window.setTimeout(() => document.getElementById("admin-users")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase || !deleteTarget) return;
    const confirmationValue = deleteTarget.email ?? deleteTarget.user_id;
    if (deleteConfirmation !== confirmationValue) {
      setDeleteMessage(`Gib zur Bestätigung ${confirmationValue} vollständig ein.`);
      return;
    }
    setSaving(`delete:${deleteTarget.user_id}`);
    setDeleteMessage(null);
    const result = await invokeAccountManagement(account.supabase, { action: "delete_user", userId: deleteTarget.user_id });
    setSaving(null);
    if (!result.ok) {
      setDeleteMessage(result.message ?? "Das Konto konnte nicht gelöscht werden.");
      return;
    }
    notify("Das gesperrte Konto wurde dauerhaft gelöscht.", "success");
    setDeleteTarget(null);
    setDeleteConfirmation("");
    await load();
  }

  if (account.loading || loading) return <><PageHeader eyebrow="System" title="Administration" description="Konten, Nutzung und Systemzustand werden geladen." /><PageSkeleton /></>;
  if (!account.configured || !account.user) return <AdminDenied text="Melde dich zuerst mit einem Administratorkonto an." />;
  if (account.access?.role !== "admin" || account.access.status !== "active") return <AdminDenied text="Dieses Konto besitzt keine aktive Administratorberechtigung." />;
  if (error || !summary) return <ErrorState message={error ?? undefined} onRetry={() => void load()} />;

  return (
    <>
      <PageHeader eyebrow="System" title="Administration" description="Vollständiger Überblick über Konten, Aktivität, Cloud-Nutzung und sicherheitsrelevante Änderungen." actions={<Button onClick={() => void load()}><RefreshCw size={15} />Aktualisieren</Button>} />

      <nav className="admin-section-nav" aria-label="Adminbereiche">
        <a href="#admin-overview">Übersicht</a>
        <a href="#admin-settings">Cloud-Funktionen</a>
        <a href="#admin-users">Konten</a>
        <a href="#admin-audit">Protokoll</a>
      </nav>

      <section id="admin-overview" className="admin-anchor-section" aria-labelledby="admin-overview-title">
        <h2 id="admin-overview-title" className="sr-only">Systemübersicht</h2>
        <div className="admin-stats-grid">
          <AdminStat icon={<Users />} label="Konten" value={summary.accounts_total} note={`${summary.accounts_confirmed} bestätigt · ${summary.accounts_unconfirmed} offen`} />
          <AdminStat icon={<Activity />} label="Aktiv in 7 Tagen" value={summary.active_7d} note={`${summary.active_24h} in 24 Std. · ${summary.active_30d} in 30 Tagen`} />
          <AdminStat icon={<BarChart3 />} label="Neue Konten" value={summary.signups_7d} note={`${summary.signups_24h} in 24 Std. · ${summary.signups_30d} in 30 Tagen`} />
          <AdminStat icon={<Gauge />} label="Aktive Sitzungen" value={summary.active_sessions} note={`Auf ${summary.accounts_with_sessions} Konten`} />
          <AdminStat icon={<Cloud />} label="Cloud-Favoriten" value={summary.favorites_total} note={`${summary.accounts_with_favorites} Konten · Ø ${formatNumber(summary.average_favorites_per_account, 1)}`} />
          <AdminStat icon={<Shield />} label="Aktive Admins" value={summary.active_admins} note={`${summary.admins} Adminrollen insgesamt`} />
          <AdminStat icon={<UserMinus />} label="Gesperrte Konten" value={summary.accounts_suspended} note={`${summary.never_signed_in} noch nie angemeldet`} />
          <AdminStat icon={<History />} label="Adminaktionen" value={summary.audit_events_7d} note={`${summary.audit_events_24h} in den letzten 24 Std.`} />
        </div>

        <div className="admin-overview-grid">
          <Card className="admin-history-card">
            <CardHeader title="Entwicklung der letzten 14 Tage" description="Registrierungen, zuletzt aktive Konten und neu gespeicherte Cloud-Favoriten pro Kalendertag." />
            <div className="admin-history-chart" role="img" aria-label="Diagramm der Registrierungen, aktiven Konten und gespeicherten Favoriten in den letzten 14 Tagen">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={summary.daily_history} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatHistoryDay} stroke="var(--text-muted)" fontSize={9} minTickGap={22} />
                  <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={9} width={34} />
                  <Tooltip content={<AdminHistoryTooltip />} />
                  <Legend verticalAlign="top" height={34} formatter={historyLegendLabel} />
                  <Bar dataKey="registrations" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="active_accounts" stroke="var(--success)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="favorites_saved" stroke="var(--warning)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="admin-health-card">
            <CardHeader title="Kontozustand" description="Anteile bezogen auf alle vorhandenen Konten." />
            <div className="admin-health-list">
              <HealthRow label="E-Mail bestätigt" value={summary.accounts_confirmed} total={summary.accounts_total} tone="success" />
              <HealthRow label="Konto aktiv" value={summary.accounts_active} total={summary.accounts_total} tone="accent" />
              <HealthRow label="In 30 Tagen aktiv" value={summary.active_30d} total={summary.accounts_total} tone="warning" />
              <HealthRow label="Mit Cloud-Favoriten" value={summary.accounts_with_favorites} total={summary.accounts_total} tone="neutral" />
            </div>
          </Card>

          <Card className="admin-attention-card">
            <CardHeader title="Handlungsbedarf" description="Ein Klick öffnet die passenden Konten im Filter." />
            <div className="admin-attention-list">
              <AttentionRow label="Unbestätigte E-Mail-Adressen" value={summary.accounts_unconfirmed} onClick={() => showAttention("unconfirmed")} />
              <AttentionRow label="Noch nie angemeldet" value={summary.never_signed_in} onClick={() => showAttention("never_signed_in")} />
              <AttentionRow label="Löschanforderungen" value={summary.deletion_requests} danger onClick={() => showAttention("deletion_requested")} />
              <AttentionRow label="Gesperrte Konten" value={summary.accounts_suspended} onClick={() => { setStatusFilter("suspended"); showAttention("all"); }} />
            </div>
          </Card>

          <Card className="admin-usage-card">
            <CardHeader title="Cloud-Nutzung" description="Verteilung und Änderungsaktivität der synchronisierten Favoriten." />
            <div className="admin-usage-metrics">
              <MiniMetric label="Markt" value={summary.market_favorites} />
              <MiniMetric label="Händler" value={summary.merchant_favorites} />
              <MiniMetric label="Auktionen" value={summary.auction_favorites} />
              <MiniMetric label="Geändert 24 Std." value={summary.favorites_changed_24h} />
              <MiniMetric label="Geändert 7 Tage" value={summary.favorites_changed_7d} />
              <MiniMetric label="Höchster Kontowert" value={summary.max_favorites_per_account} />
            </div>
          </Card>

          <Card className="admin-top-users-card">
            <CardHeader title="Stärkste Favoritennutzung" description="Konten mit den meisten Cloud-Favoriten." />
            <div className="admin-top-users">
              {topUsers.length ? topUsers.map((user, index) => (
                <button key={user.user_id} type="button" onClick={() => setSelectedUser(user)}>
                  <span>{index + 1}</span>
                  <strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}<small>{user.email ?? user.user_id}</small></strong>
                  <b>{formatNumber(user.favorites_count, 0)}</b>
                </button>
              )) : <p className="compact-empty">Noch keine Cloud-Favoriten gespeichert.</p>}
            </div>
          </Card>

          <Card className="admin-runtime-card">
            <CardHeader title="Betriebsparameter" description="Aktive technische Grenzen und Schutzmechanismen des Accountsystems." />
            <dl className="admin-runtime-list">
              <RuntimeDetail label="Favoritenlimit" value="1.500 pro Konto" />
              <RuntimeDetail label="Auktions-Snapshot" value="Maximal 64 KiB" />
              <RuntimeDetail label="Adminprotokoll" value="Bis zu 250 Einträge" />
              <RuntimeDetail label="Adminzugriff" value="Serverseitig geprüft" />
              <RuntimeDetail label="Cloud-Synchronisierung" value={account.settings.cloudFavoritesEnabled ? "Aktiv" : "Pausiert"} positive={account.settings.cloudFavoritesEnabled} />
              <RuntimeDetail label="Profiländerungen" value={account.settings.profileUpdatesEnabled ? "Aktiv" : "Pausiert"} positive={account.settings.profileUpdatesEnabled} />
            </dl>
          </Card>
        </div>
      </section>

      <section id="admin-settings" className="admin-anchor-section">
        <Card>
          <CardHeader title="Cloud-Funktionen" description="Diese Schalter werden serverseitig erzwungen und in Supabase protokolliert." />
          <div className="admin-settings-list">
            <SettingRow title="Favoriten synchronisieren" description="Geräteübergreifenden Abgleich für aktive Benutzer erlauben." checked={account.settings.cloudFavoritesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("cloud_favorites_enabled", value)} />
            <SettingRow title="Profiländerungen erlauben" description="Benutzer dürfen ihren Anzeigenamen ändern." checked={account.settings.profileUpdatesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("profile_updates_enabled", value)} />
          </div>
        </Card>
      </section>

      <section id="admin-users" className="admin-anchor-section">
        <Card className="admin-users-card">
          <CardHeader title="Konten und Berechtigungen" description={`${filteredUsers.length} von ${users.length} Konten sichtbar · Löschen ist erst nach einer Sperrung möglich`} action={<Button size="sm" onClick={exportUsers} disabled={!filteredUsers.length}><Download size={14} />CSV</Button>} />
          <div className="admin-user-toolbar" aria-label="Konten filtern">
            <label className="admin-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Konten suchen</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, E-Mail oder Konto-ID" /></label>
            <Select aria-label="Nach Rolle filtern" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}><option value="all">Alle Rollen</option><option value="user">Benutzer</option><option value="admin">Administratoren</option></Select>
            <Select aria-label="Nach Status filtern" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Alle Status</option><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select>
            <Select aria-label="Nach Kontosignal filtern" value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value as AdminAttentionFilter)}><option value="all">Alle Kontosignale</option><option value="unconfirmed">E-Mail unbestätigt</option><option value="never_signed_in">Noch nie angemeldet</option><option value="deletion_requested">Löschung angefordert</option><option value="active_7d">Aktiv in 7 Tagen</option></Select>
          </div>
          <div className="data-table-wrap">
            <table className="data-table admin-users-table desktop-table">
              <thead><tr><th>Konto</th><th>Status</th><th>Rolle</th><th>Favoriten</th><th>Aktivität</th><th>Aktionen</th></tr></thead>
              <tbody>{filteredUsers.length ? filteredUsers.map((user) => {
                const ownAccount = user.user_id === account.user?.id;
                const draft = drafts[user.user_id] ?? { role: user.role, status: user.status };
                const deleting = saving === `delete:${user.user_id}` || Boolean(user.deletion_requested_at);
                return (
                  <tr key={user.user_id}>
                    <td><strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}</strong><small>{user.email ?? user.user_id}</small><Badge tone={user.email_confirmed ? "success" : "warning"}>{user.email_confirmed ? "Bestätigt" : "Unbestätigt"}</Badge>{user.auth_banned_until ? <Badge tone="danger">Auth-Sperre</Badge> : null}{user.deletion_requested_at ? <Badge tone="danger">Löschung läuft</Badge> : null}</td>
                    <td><Select aria-label={`Kontostatus für ${user.email ?? user.user_id}`} value={draft.status} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, status: event.target.value as AccessDraft["status"] } }))}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select></td>
                    <td><Select aria-label={`Rolle für ${user.email ?? user.user_id}`} value={draft.role} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, role: event.target.value as AccessDraft["role"] } }))}><option value="user">Benutzer</option><option value="admin">Administrator</option></Select></td>
                    <td>{formatNumber(user.favorites_count, 0)}<small>{user.market_favorites} Markt · {user.merchant_favorites} Händler · {user.auction_favorites} Auktion</small><small>{user.last_favorite_at ? `Zuletzt ${formatRelativeTime(user.last_favorite_at)}` : "Noch keine gespeichert"}</small></td>
                    <td>{user.last_seen_at ? formatRelativeTime(user.last_seen_at) : user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : "Noch nie"}<small>{user.active_sessions} aktive Sitzungen</small><small>Erstellt {formatDateTime(user.created_at)}</small></td>
                    <td><div className="admin-row-actions"><Button size="sm" onClick={() => setSelectedUser(user)}><Eye size={14} />Details</Button><Button size="sm" disabled={ownAccount || saving !== null || (draft.role === user.role && draft.status === user.status)} onClick={() => void saveAccess(user)}><Save size={14} />{saving === user.user_id ? "Speichert …" : "Speichern"}</Button><Button size="sm" variant="danger" disabled={ownAccount || saving !== null || user.status !== "suspended" || deleting} onClick={() => { setDeleteTarget(user); setDeleteConfirmation(""); setDeleteMessage(null); }}><Trash2 size={14} />Löschen</Button></div></td>
                  </tr>
                );
              }) : <tr><td colSpan={6}><p className="compact-empty">Keine Konten entsprechen diesen Filtern.</p></td></tr>}</tbody>
            </table>
          </div>
          <div className="mobile-card-list admin-user-cards">
            {filteredUsers.length ? filteredUsers.map((user) => {
              const ownAccount = user.user_id === account.user?.id;
              const draft = drafts[user.user_id] ?? { role: user.role, status: user.status };
              const deleting = saving === `delete:${user.user_id}` || Boolean(user.deletion_requested_at);
              return (
                <article className="mobile-data-card" key={user.user_id}>
                  <div className="mobile-data-card-header">
                    <div className="mobile-data-card-main"><strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}</strong><small>{user.email ?? user.user_id}</small></div>
                    <Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Aktiv" : "Gesperrt"}</Badge>
                  </div>
                  <div className="mobile-data-values">
                    <div className="mobile-data-value"><span>Rolle</span><strong>{user.role === "admin" ? "Administrator" : "Benutzer"}</strong></div>
                    <div className="mobile-data-value"><span>Favoriten</span><strong>{formatNumber(user.favorites_count, 0)}</strong></div>
                    <div className="mobile-data-value"><span>E-Mail</span><strong>{user.email_confirmed ? "Bestätigt" : "Unbestätigt"}</strong></div>
                    <div className="mobile-data-value"><span>Sitzungen</span><strong>{formatNumber(user.active_sessions, 0)}</strong></div>
                    <div className="mobile-data-value"><span>Aktivität</span><strong>{user.last_seen_at ? formatRelativeTime(user.last_seen_at) : user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : "Noch nie"}</strong></div>
                    <div className="mobile-data-value"><span>Provider</span><strong>{user.auth_providers.map(providerLabel).join(", ") || "Keine"}</strong></div>
                  </div>
                  <div className="admin-mobile-controls">
                    <label><span>Status</span><Select aria-label={`Kontostatus für ${user.email ?? user.user_id}`} value={draft.status} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, status: event.target.value as AccessDraft["status"] } }))}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select></label>
                    <label><span>Rolle</span><Select aria-label={`Rolle für ${user.email ?? user.user_id}`} value={draft.role} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, role: event.target.value as AccessDraft["role"] } }))}><option value="user">Benutzer</option><option value="admin">Administrator</option></Select></label>
                  </div>
                  <div className="admin-account-badges">{!user.email_confirmed ? <Badge tone="warning">E-Mail offen</Badge> : null}{user.auth_banned_until ? <Badge tone="danger">Auth-Sperre</Badge> : null}{user.deletion_requested_at ? <Badge tone="danger">Löschung läuft</Badge> : null}</div>
                  <div className="mobile-data-actions">
                    <Button size="sm" onClick={() => setSelectedUser(user)}><Eye size={14} />Details</Button>
                    <Button size="sm" disabled={ownAccount || saving !== null || (draft.role === user.role && draft.status === user.status)} onClick={() => void saveAccess(user)}><Save size={14} />{saving === user.user_id ? "Speichert …" : "Speichern"}</Button>
                    <Button size="sm" variant="danger" disabled={ownAccount || saving !== null || user.status !== "suspended" || deleting} onClick={() => { setDeleteTarget(user); setDeleteConfirmation(""); setDeleteMessage(null); }}><Trash2 size={14} />Löschen</Button>
                  </div>
                </article>
              );
            }) : <p className="compact-empty">Keine Konten entsprechen diesen Filtern.</p>}
          </div>
        </Card>
      </section>

      <section id="admin-audit" className="admin-anchor-section">
        <Card className="admin-audit-card">
          <CardHeader title="Admin-Protokoll" description={`${filteredAudit.length} von ${audit.length} sicherheitsrelevanten Änderungen sichtbar`} action={<Button size="sm" onClick={exportAudit} disabled={!filteredAudit.length}><Download size={14} />CSV</Button>} />
          <div className="admin-audit-toolbar" aria-label="Adminprotokoll filtern">
            <label className="admin-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Protokoll durchsuchen</span><Input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Aktion, Admin oder Zielkonto" /></label>
            <Select aria-label="Nach Protokollaktion filtern" value={auditAction} onChange={(event) => setAuditAction(event.target.value)}><option value="all">Alle Aktionen</option>{auditActions.map((action) => <option value={action} key={action}>{auditLabel(action)}</option>)}</Select>
          </div>
          <div className="audit-list">{filteredAudit.length ? filteredAudit.map((entry) => (
            <article key={entry.id}><span className="audit-icon"><ShieldAlert size={16} /></span><div><strong>{auditLabel(entry.action)}</strong><p>{entry.actor_email ?? "System"}{entry.target_email ? ` · Ziel: ${entry.target_email}` : ""}</p></div><time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time><Button size="icon" aria-label={`Details zu ${auditLabel(entry.action)}`} onClick={() => setSelectedAudit(entry)}><Eye size={14} /></Button></article>
          )) : <p className="compact-empty">Keine Protokolleinträge entsprechen diesen Filtern.</p>}</div>
        </Card>
      </section>

      <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title="Kontodetails" description="Verifizierte Auth-, Rollen-, Sitzungs- und Nutzungsdaten." wide>
        {selectedUser ? <UserDetails user={selectedUser} /> : null}
      </Dialog>

      <Dialog open={Boolean(selectedAudit)} onClose={() => setSelectedAudit(null)} title="Protokolldetails" description="Vollständiger serverseitig gespeicherter Eintrag der Adminaktion." wide>
        {selectedAudit ? <AuditDetails entry={selectedAudit} /> : null}
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => { if (!saving?.startsWith("delete:")) setDeleteTarget(null); }} title="Gesperrtes Konto löschen" description="Das Auth-Konto und alle verknüpften Dashboarddaten werden dauerhaft entfernt.">
        {deleteTarget ? <form className="account-form dialog-account-form" onSubmit={deleteUser}>
          <div className="destructive-notice"><Trash2 size={20} /><p>Diese Aktion ist unwiderruflich. Das Konto ist aktuell gesperrt und kann nach der Löschung nicht wiederhergestellt werden.</p></div>
          <div><FieldLabel htmlFor="admin-delete-confirmation">Zur Bestätigung {deleteTarget.email ?? deleteTarget.user_id} eingeben</FieldLabel><Input id="admin-delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" disabled={saving?.startsWith("delete:")} required /></div>
          {deleteMessage ? <p className="form-message" role="alert">{deleteMessage}</p> : null}
          <div className="dialog-footer-actions"><Button type="button" onClick={() => setDeleteTarget(null)} disabled={saving?.startsWith("delete:")}>Abbrechen</Button><Button type="submit" variant="danger" disabled={saving?.startsWith("delete:") || deleteConfirmation !== (deleteTarget.email ?? deleteTarget.user_id)}><Trash2 size={15} />{saving?.startsWith("delete:") ? "Löscht Konto …" : "Konto dauerhaft löschen"}</Button></div>
        </form> : null}
      </Dialog>
    </>
  );
}

function UserDetails({ user }: { user: AdminUser }) {
  return <div className="admin-user-details">
    <div className="admin-detail-hero"><div><strong>{user.display_name ?? "Ohne Anzeigenamen"}</strong><span>{user.email ?? "Keine E-Mail-Adresse"}</span></div><div><Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Aktiv" : "Gesperrt"}</Badge><Badge tone={user.role === "admin" ? "accent" : "neutral"}>{user.role === "admin" ? "Administrator" : "Benutzer"}</Badge>{user.auth_banned_until ? <Badge tone="danger">Auth-Sperre</Badge> : null}{user.is_anonymous ? <Badge tone="warning">Anonym</Badge> : null}</div></div>
    <dl className="admin-detail-grid">
      <Detail label="Konto-ID" value={user.user_id} mono />
      <Detail label="Anmeldeverfahren" value={user.auth_providers.map(providerLabel).join(", ") || "Nicht erfasst"} />
      <Detail label="E-Mail bestätigt" value={user.email_confirmed_at ? formatDateTime(user.email_confirmed_at) : "Nein"} />
      <Detail label="Erstellt" value={formatDateTime(user.created_at)} />
      <Detail label="Auth-Daten geändert" value={formatDateTime(user.auth_updated_at)} />
      <Detail label="Profil geändert" value={formatDateTime(user.profile_updated_at)} />
      <Detail label="Berechtigung geändert" value={formatDateTime(user.access_updated_at)} />
      <Detail label="Letzte Anmeldung" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Noch nie"} />
      <Detail label="Zuletzt aktiv" value={user.last_seen_at ? formatDateTime(user.last_seen_at) : "Noch nicht erfasst"} />
      <Detail label="Aktive Sitzungen" value={formatNumber(user.active_sessions, 0)} />
      <Detail label="Letzte Sitzung erstellt" value={user.last_session_at ? formatDateTime(user.last_session_at) : "Keine aktive Sitzung"} />
      <Detail label="Letzter Favorit" value={user.last_favorite_at ? formatDateTime(user.last_favorite_at) : "Keine Favoriten"} />
      <Detail label="Snapshot-Speicher" value={formatBytes(user.favorite_snapshot_bytes)} />
      <Detail label="Auth-Sperre bis" value={user.auth_banned_until ? formatDateTime(user.auth_banned_until) : "Keine"} />
      <Detail label="Anonymes Konto" value={user.is_anonymous ? "Ja" : "Nein"} />
      <Detail label="Löschanforderung" value={user.deletion_requested_at ? formatDateTime(user.deletion_requested_at) : "Keine"} />
    </dl>
    <div className="admin-favorite-breakdown"><div><small>Markt</small><strong>{formatNumber(user.market_favorites, 0)}</strong></div><div><small>Händler</small><strong>{formatNumber(user.merchant_favorites, 0)}</strong></div><div><small>Auktionen</small><strong>{formatNumber(user.auction_favorites, 0)}</strong></div><div><small>Gesamt</small><strong>{formatNumber(user.favorites_count, 0)}</strong></div></div>
  </div>;
}

function AuditDetails({ entry }: { entry: AdminAudit }) {
  return <div className="admin-audit-details">
    <dl className="admin-detail-grid">
      <Detail label="Protokoll-ID" value={String(entry.id)} mono />
      <Detail label="Zeitpunkt" value={formatDateTime(entry.created_at)} />
      <Detail label="Aktion" value={auditLabel(entry.action)} />
      <Detail label="Technischer Aktionsname" value={entry.action} mono />
      <Detail label="Ausgeführt von" value={entry.actor_email ?? "System"} />
      <Detail label="Admin-ID" value={entry.actor_id ?? "System"} mono />
      <Detail label="Zielkonto" value={entry.target_email ?? "Kein Zielkonto"} />
      <Detail label="Zielkonto-ID" value={entry.target_user_id ?? "Nicht vorhanden"} mono />
    </dl>
    <div className="admin-audit-payload"><small>Gespeicherte Zusatzdaten</small><pre>{JSON.stringify(entry.details, null, 2)}</pre></div>
  </div>;
}

function AdminHistoryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return <div className="chart-tooltip"><strong>{formatHistoryDate(label)}</strong>{payload.map((item) => <span key={item.dataKey}>{historyLegendLabel(item.dataKey)}: {formatNumber(item.value, 0)}</span>)}</div>;
}

function HealthRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "success" | "accent" | "warning" | "neutral" }) {
  const percentage = total ? Math.min(100, Math.max(0, value / total * 100)) : 0;
  return <div><span><strong>{label}</strong><small>{formatNumber(value, 0)} von {formatNumber(total, 0)} · {formatNumber(percentage, 1)} %</small></span><div className="admin-health-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><i className={`tone-${tone}`} style={{ width: `${percentage}%` }} /></div></div>;
}

function AttentionRow({ label, value, danger = false, onClick }: { label: string; value: number; danger?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span>{label}</span><strong className={danger && value > 0 ? "danger-text" : undefined}>{formatNumber(value, 0)}</strong></button>;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div><small>{label}</small><strong>{formatNumber(value, 0)}</strong></div>;
}

function RuntimeDetail({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div><dt>{label}</dt><dd className={positive === undefined ? undefined : positive ? "success-text" : "danger-text"}>{value}</dd></div>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt>{label}</dt><dd className={mono ? "mono-value" : undefined}>{value}</dd></div>;
}

function AdminDenied({ text }: { text: string }) {
  return <><PageHeader eyebrow="System" title="Administration" description="Dieser Bereich ist nur für aktive Administratorkonten sichtbar." /><Card className="account-message-card"><ShieldAlert size={25} /><div><h2>Zugriff nicht möglich</h2><p>{text}</p></div></Card></>;
}

function AdminStat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  return <Card className="admin-stat"><span>{icon}</span><div><small>{label}</small><strong>{formatNumber(value, 0)}</strong><p>{note}</p></div></Card>;
}

function SettingRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="admin-setting"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function formatHistoryDay(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function historyLegendLabel(value: string): string {
  if (value === "registrations") return "Registrierungen";
  if (value === "active_accounts") return "Aktive Konten";
  if (value === "favorites_saved") return "Neue Favoriten";
  return value;
}

function providerLabel(provider: string): string {
  if (provider === "email") return "E-Mail";
  return provider.charAt(0).toLocaleUpperCase("de-DE") + provider.slice(1);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${formatNumber(value, 0)} Byte`;
  if (value < 1024 * 1024) return `${formatNumber(value / 1024, 1)} KiB`;
  return `${formatNumber(value / 1024 / 1024, 1)} MiB`;
}

function auditLabel(action: string): string {
  if (action === "initial_admin_created") return "Erstes Administratorkonto erstellt";
  if (action === "admin_bootstrapped") return "Administratorkonto eingerichtet";
  if (action === "account_access_updated") return "Kontoberechtigung geändert";
  if (action === "setting_updated") return "Systemeinstellung geändert";
  if (action === "account_self_delete_requested") return "Benutzerkonto selbst gelöscht";
  if (action === "account_self_delete_failed") return "Selbstlöschung fehlgeschlagen";
  if (action === "admin_account_delete_requested") return "Gesperrtes Konto durch Admin gelöscht";
  if (action === "admin_account_delete_failed") return "Admin-Löschung fehlgeschlagen";
  return action;
}
