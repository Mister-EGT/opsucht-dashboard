"use client";

import { Activity, Cloud, RefreshCw, Save, Shield, ShieldAlert, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/account-provider";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { adminAuditSchema, adminSummarySchema, adminUserSchema, type AdminAudit, type AdminSummary, type AdminUser } from "@/lib/account";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format";

interface AccessDraft {
  role: "user" | "admin";
  status: "active" | "suspended";
}

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

  const load = useCallback(async () => {
    if (!account.supabase || account.access?.role !== "admin" || account.access.status !== "active") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [summaryResult, usersResult, auditResult] = await Promise.all([
      account.supabase.rpc("admin_dashboard"),
      account.supabase.rpc("admin_list_users"),
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
    setLoading(false);
  }, [account.access, account.supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

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
          <CardHeader title="Cloud-Funktionen" description="Diese Schalter wirken für alle Konten und werden in Supabase protokolliert." />
          <div className="admin-settings-list">
            <SettingRow title="Favoriten synchronisieren" description="Geräteübergreifenden Abgleich erlauben." checked={account.settings.cloudFavoritesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("cloud_favorites_enabled", value)} />
            <SettingRow title="Profiländerungen erlauben" description="Benutzer dürfen ihren Anzeigenamen ändern." checked={account.settings.profileUpdatesEnabled} disabled={saving !== null} onChange={(value) => void updateSetting("profile_updates_enabled", value)} />
          </div>
        </Card>

        <Card className="admin-users-card">
          <CardHeader title="Konten und Berechtigungen" description={`${users.length} Konten · das eigene Adminkonto ist gegen versehentliche Änderung geschützt`} />
          <div className="data-table-wrap">
            <table className="data-table admin-users-table">
              <thead><tr><th>Konto</th><th>Status</th><th>Rolle</th><th>Favoriten</th><th>Letzte Anmeldung</th><th>Aktion</th></tr></thead>
              <tbody>{users.map((user) => {
                const ownAccount = user.user_id === account.user?.id;
                const draft = drafts[user.user_id] ?? { role: user.role, status: user.status };
                return (
                  <tr key={user.user_id}>
                    <td><strong>{user.display_name ?? user.email ?? "Unbekanntes Konto"}</strong><small>{user.email ?? user.user_id}</small><Badge tone={user.email_confirmed ? "success" : "warning"}>{user.email_confirmed ? "Bestätigt" : "Unbestätigt"}</Badge></td>
                    <td><Select aria-label={`Kontostatus für ${user.email ?? user.user_id}`} value={draft.status} disabled={ownAccount || saving !== null} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, status: event.target.value as AccessDraft["status"] } }))}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></Select></td>
                    <td><Select aria-label={`Rolle für ${user.email ?? user.user_id}`} value={draft.role} disabled={ownAccount || saving !== null} onChange={(event) => setDrafts((current) => ({ ...current, [user.user_id]: { ...draft, role: event.target.value as AccessDraft["role"] } }))}><option value="user">Benutzer</option><option value="admin">Administrator</option></Select></td>
                    <td>{formatNumber(user.favorites_count, 0)}</td>
                    <td>{user.last_sign_in_at ? formatRelativeTime(user.last_sign_in_at) : "Noch nie"}<small>Erstellt {formatDateTime(user.created_at)}</small></td>
                    <td><Button size="sm" disabled={ownAccount || saving !== null || (draft.role === user.role && draft.status === user.status)} onClick={() => void saveAccess(user)}><Save size={14} />{saving === user.user_id ? "Speichert …" : "Speichern"}</Button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>

        <Card className="admin-audit-card">
          <CardHeader title="Admin-Protokoll" description="Die letzten sicherheitsrelevanten Änderungen an Konten und Systemeinstellungen." />
          <div className="audit-list">{audit.length ? audit.map((entry) => (
            <article key={entry.id}><span className="audit-icon"><ShieldAlert size={16} /></span><div><strong>{auditLabel(entry.action)}</strong><p>{entry.actor_email ?? "System"}{entry.target_email ? ` · Ziel: ${entry.target_email}` : ""}</p></div><time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time></article>
          )) : <p className="compact-empty">Noch keine Adminaktionen protokolliert.</p>}</div>
        </Card>
      </div>
    </>
  );
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
  if (action === "account_access_updated") return "Kontoberechtigung geändert";
  if (action === "setting_updated") return "Systemeinstellung geändert";
  return action;
}
