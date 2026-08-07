"use client";

import {
  Activity,
  Cloud,
  Download,
  Eye,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
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
import { adminAuditSchema, adminSummarySchema, adminUsersToCsv, adminUserSchema, downloadTextFile, filterAdminUsers, type AdminAudit, type AdminSummary, type AdminUser } from "@/lib/account";
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
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
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
      account.supabase.rpc("admin_list_users_v2"),
      account.supabase.rpc("admin_list_audit", { p_limit: 100 }),
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
    () => filterAdminUsers(users, query, roleFilter, statusFilter),
    [query, roleFilter, statusFilter, users],
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

  if (account.loading || loading) return <><PageHeader eyebrow="System" title="Administration" description="Konten und Cloud-Funktionen werden geladen." /><PageSkeleton /></>;
  if (!account.configured || !account.user) return <AdminDenied text="Melde dich zuerst mit einem Administratorkonto an." />;
  if (account.access?.role !== "admin" || account.access.status !== "active") return <AdminDenied text="Dieses Konto besitzt keine aktive Administratorberechtigung." />;
  if (error || !summary) return <ErrorState message={error ?? undefined} onRetry={() => void load()} />;

  return (
    <>
      <PageHeader eyebrow="System" title="Administration" description="Konten, Rollen, Cloud-Funktionen und protokollierte Änderungen verwalten." actions={<Button onClick={() => void load()}><RefreshCw size={15} />Aktualisieren</Button>} />
      <div className="admin-stats-grid">
        <AdminStat icon={<Users />} label="Konten" value={summary.accounts_total} note={`${summary.accounts_confirmed} bestätigt`} />
        <AdminStat icon={<Shield />} label="Administratoren" value={summary.admins} note={`${summary.accounts_suspended} gesperrt`} />
        <AdminStat icon={<Cloud />} label="Cloud-Favoriten" value={summary.favorites_total} note={`${summary.market_favorites} Markt · ${summary.merchant_favorites} Händler · ${summary.auction_favorites} Auktion`} />
        <AdminStat icon={<Activity />} label="Aktive Sitzungen" value={summary.active_sessions} note={`${summary.accounts_active} aktive Konten`} />
      </div>

      <div className="admin-layout">
        <Card>
          <CardHeader title="Cloud-Funktionen" description="Diese Schalter werden serverseitig erzwungen und in Supabase protokolliert." />
          <div className="admin-settings-list">
            <SettingRow title="Favoriten synchronisieren" description="Geräteübergreifenden Abgleich für aktive Benutzer erlauben." checked={account.settings.cloudFavoritesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("cloud_favorites_enabled", value)} />
            <SettingRow title="Profiländerungen erlauben" description="Benutzer dürfen ihren Anzeigenamen ändern." checked={account.settings.profileUpdatesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("profile_updates_enabled", value)} />
          </div>
        </Card>

        <Card className="admin-users-card">
          <CardHeader title="Konten und Berechtigungen" description={`${filteredUsers.length} von ${users.length} Konten sichtbar · Löschen ist erst nach einer Sperrung möglich`} action={<Button size="sm" onClick={exportUsers} disabled={!filteredUsers.length}><Download size={14} />CSV</Button>} />
          <div className="admin-user-toolbar" aria-label="Konten filtern">
            <label className="admin-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Konten suchen</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, E-Mail oder Konto-ID" /></label>
            <Select aria-label="Nach Rolle filtern" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}><option value="all">Alle Rollen</option><option value="user">Benutzer</option><option value="admin">Administratoren</option></Select>
            <Select aria-label="Nach Status filtern" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Alle Status</option><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select>
          </div>
          <div className="data-table-wrap">
            <table className="data-table admin-users-table desktop-table">
              <thead><tr><th>Konto</th><th>Status</th><th>Rolle</th><th>Favoriten</th><th>Letzte Aktivität</th><th>Aktionen</th></tr></thead>
              <tbody>{filteredUsers.length ? filteredUsers.map((user) => {
                const ownAccount = user.user_id === account.user?.id;
                const draft = drafts[user.user_id] ?? { role: user.role, status: user.status };
                const deleting = saving === `delete:${user.user_id}` || Boolean(user.deletion_requested_at);
                return (
                  <tr key={user.user_id}>
                    <td><strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}</strong><small>{user.email ?? user.user_id}</small><Badge tone={user.email_confirmed ? "success" : "warning"}>{user.email_confirmed ? "Bestätigt" : "Unbestätigt"}</Badge>{user.deletion_requested_at ? <Badge tone="danger">Löschung läuft</Badge> : null}</td>
                    <td><Select aria-label={`Kontostatus für ${user.email ?? user.user_id}`} value={draft.status} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, status: event.target.value as AccessDraft["status"] } }))}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select></td>
                    <td><Select aria-label={`Rolle für ${user.email ?? user.user_id}`} value={draft.role} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, role: event.target.value as AccessDraft["role"] } }))}><option value="user">Benutzer</option><option value="admin">Administrator</option></Select></td>
                    <td>{formatNumber(user.favorites_count, 0)}<small>{user.market_favorites} Markt · {user.merchant_favorites} Händler · {user.auction_favorites} Auktion</small></td>
                    <td>{user.last_seen_at ? formatRelativeTime(user.last_seen_at) : user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : "Noch nie"}<small>Erstellt {formatDateTime(user.created_at)}</small></td>
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
                    <div className="mobile-data-card-main">
                      <strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}</strong>
                      <small>{user.email ?? user.user_id}</small>
                    </div>
                    <Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Aktiv" : "Gesperrt"}</Badge>
                  </div>
                  <div className="mobile-data-values">
                    <div className="mobile-data-value"><span>Rolle</span><strong>{user.role === "admin" ? "Administrator" : "Benutzer"}</strong></div>
                    <div className="mobile-data-value"><span>Favoriten</span><strong>{formatNumber(user.favorites_count, 0)}</strong></div>
                    <div className="mobile-data-value"><span>E-Mail</span><strong>{user.email_confirmed ? "Bestätigt" : "Unbestätigt"}</strong></div>
                    <div className="mobile-data-value"><span>Aktivität</span><strong>{user.last_seen_at ? formatRelativeTime(user.last_seen_at) : user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : "Noch nie"}</strong></div>
                  </div>
                  <div className="admin-mobile-controls">
                    <label><span>Status</span><Select aria-label={`Kontostatus für ${user.email ?? user.user_id}`} value={draft.status} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, status: event.target.value as AccessDraft["status"] } }))}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select></label>
                    <label><span>Rolle</span><Select aria-label={`Rolle für ${user.email ?? user.user_id}`} value={draft.role} disabled={ownAccount || saving !== null || deleting} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, role: event.target.value as AccessDraft["role"] } }))}><option value="user">Benutzer</option><option value="admin">Administrator</option></Select></label>
                  </div>
                  {user.deletion_requested_at ? <Badge tone="danger">Löschung läuft</Badge> : null}
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

        <Card className="admin-audit-card">
          <CardHeader title="Admin-Protokoll" description="Die letzten sicherheitsrelevanten Änderungen an Konten und Systemeinstellungen." />
          <div className="audit-list">{audit.length ? audit.map((entry) => (
            <article key={entry.id}><span className="audit-icon"><ShieldAlert size={16} /></span><div><strong>{auditLabel(entry.action)}</strong><p>{entry.actor_email ?? "System"}{entry.target_email ? ` · Ziel: ${entry.target_email}` : ""}</p></div><time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time></article>
          )) : <p className="compact-empty">Noch keine Adminaktionen protokolliert.</p>}</div>
        </Card>
      </div>

      <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title="Kontodetails" description="Verifizierte Auth-, Rollen- und Nutzungsdaten." wide>
        {selectedUser ? <UserDetails user={selectedUser} /> : null}
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
    <div className="admin-detail-hero"><div><strong>{user.display_name ?? "Ohne Anzeigenamen"}</strong><span>{user.email ?? "Keine E-Mail-Adresse"}</span></div><div><Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Aktiv" : "Gesperrt"}</Badge><Badge tone={user.role === "admin" ? "accent" : "neutral"}>{user.role === "admin" ? "Administrator" : "Benutzer"}</Badge></div></div>
    <dl className="admin-detail-grid">
      <Detail label="Konto-ID" value={user.user_id} mono />
      <Detail label="E-Mail bestätigt" value={user.email_confirmed ? "Ja" : "Nein"} />
      <Detail label="Erstellt" value={formatDateTime(user.created_at)} />
      <Detail label="Letzte Anmeldung" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Noch nie"} />
      <Detail label="Zuletzt aktiv" value={user.last_seen_at ? formatDateTime(user.last_seen_at) : "Noch nicht erfasst"} />
      <Detail label="Löschanforderung" value={user.deletion_requested_at ? formatDateTime(user.deletion_requested_at) : "Keine"} />
    </dl>
    <div className="admin-favorite-breakdown"><div><small>Markt</small><strong>{formatNumber(user.market_favorites, 0)}</strong></div><div><small>Händler</small><strong>{formatNumber(user.merchant_favorites, 0)}</strong></div><div><small>Auktionen</small><strong>{formatNumber(user.auction_favorites, 0)}</strong></div><div><small>Gesamt</small><strong>{formatNumber(user.favorites_count, 0)}</strong></div></div>
  </div>;
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
