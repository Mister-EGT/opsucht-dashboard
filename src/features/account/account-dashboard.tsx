"use client";

import {
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Fingerprint,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAccount } from "@/components/account-provider";
import { useFavorites } from "@/components/favorites-provider";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input } from "@/components/ui/form";
import { PageSkeleton } from "@/components/ui/states";
import { invokeAccountManagement } from "@/lib/account-management";
import { authErrorMessage, displayNameSchema, downloadTextFile, emailSchema, passwordSchema } from "@/lib/account";
import { favoriteStorageKey } from "@/lib/favorites-sync";
import { formatDateTime } from "@/lib/format";

type AuthMode = "login" | "signup";
type BusyAction = "profile" | "password" | "logout" | "logout-all" | "delete" | null;

export function AccountDashboard() {
  const account = useAccount();

  if (account.loading) {
    return <><PageHeader eyebrow="Persönlich" title="Konto" description="Kontodaten werden sicher geladen." /><PageSkeleton cards={3} /></>;
  }

  if (!account.configured || !account.supabase) {
    return (
      <>
        <PageHeader eyebrow="Persönlich" title="Konto" description="Favoriten können mit einem kostenlosen Konto auf mehreren Geräten verwendet werden." />
        <Card className="account-message-card">
          <Cloud size={24} aria-hidden="true" />
          <div><h2>Cloud-Konten sind noch nicht konfiguriert</h2><p>Das Dashboard bleibt vollständig nutzbar und speichert Favoriten weiterhin lokal. Für Konten müssen die beiden öffentlichen Supabase-Variablen gesetzt werden.</p></div>
        </Card>
      </>
    );
  }

  if (!account.user) return <AuthPanel />;
  return <SignedInAccount />;
}

function AuthPanel() {
  const account = useAccount();
  const { notify } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const deletedMessageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("deleted") === "1") {
      if (deletedMessageRef.current) deletedMessageRef.current.hidden = false;
      window.history.replaceState(null, "", "/account");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase) return;
    const validEmail = emailSchema.safeParse(email);
    const validPassword = passwordSchema.safeParse(password);
    const validName = mode === "signup" ? displayNameSchema.safeParse(displayName) : null;
    if (!validEmail.success || !validPassword.success || (validName && !validName.success)) {
      const firstError = !validEmail.success
        ? validEmail.error.issues[0]?.message
        : !validPassword.success
          ? validPassword.error.issues[0]?.message
          : validName && !validName.success
            ? validName.error.issues[0]?.message
            : null;
      setMessage(firstError ?? "Bitte prüfe deine Eingaben.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = mode === "login"
      ? await account.supabase.auth.signInWithPassword({ email: validEmail.data, password })
      : await account.supabase.auth.signUp({
          email: validEmail.data,
          password,
          options: {
            data: { display_name: validName?.success ? validName.data : null },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
          },
        });
    setBusy(false);

    if (result.error) {
      setMessage(authErrorMessage(result.error.message));
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Konto erstellt. Öffne den Bestätigungslink in deiner E-Mail, um dich anzumelden.");
      return;
    }
    notify(mode === "login" ? "Erfolgreich angemeldet." : "Konto erfolgreich erstellt.");
  }

  async function resetPassword() {
    if (!account.supabase) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    setBusy(true);
    const { error } = await account.supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account`,
    });
    setBusy(false);
    setMessage(error ? authErrorMessage(error.message) : "Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.");
  }

  return (
    <>
      <PageHeader eyebrow="Persönlich" title="Konto" description="Synchronisiere Favoriten und verwalte dein Dashboard-Profil auf allen Geräten." />
      <div className="account-auth-layout">
        <Card className="account-auth-card">
          <div className="auth-mode-tabs" role="tablist" aria-label="Kontozugang">
            <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(null); }}>Anmelden</button>
            <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(null); }}>Registrieren</button>
          </div>
          <form className="account-form" onSubmit={submit} noValidate>
            {mode === "signup" ? <div><FieldLabel htmlFor="display-name">Anzeigename</FieldLabel><Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" maxLength={40} required /></div> : null}
            <div><FieldLabel htmlFor="account-email">E-Mail-Adresse</FieldLabel><Input id="account-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></div>
            <div><FieldLabel htmlFor="account-password">Passwort</FieldLabel><Input id="account-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} required /><small className="field-help">Mindestens 10 Zeichen, ein Buchstabe und eine Zahl.</small></div>
            <p ref={deletedMessageRef} className="form-message" role="status" hidden>Dein Konto und die zugehörigen Cloud-Daten wurden dauerhaft gelöscht.</p>
            {message ? <p className="form-message" role="status">{message}</p> : null}
            <Button type="submit" variant="primary" disabled={busy}><LogIn size={16} aria-hidden="true" />{busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Konto erstellen"}</Button>
            {mode === "login" ? <Button type="button" variant="ghost" disabled={busy} onClick={resetPassword}>Passwort vergessen</Button> : null}
          </form>
        </Card>
        <div className="account-benefits">
          <Benefit icon={<Cloud />} title="Favoriten auf allen Geräten" description="Markt-, Händler- und Auktionsfavoriten werden nach der Anmeldung automatisch zusammengeführt." />
          <Benefit icon={<ShieldCheck />} title="Privat durch RLS" description="Datenbankregeln begrenzen Kontodaten auf den jeweiligen Benutzer. Adminzugriffe werden zusätzlich protokolliert." />
          <Benefit icon={<KeyRound />} title="Sicherer Kontozugang" description="E-Mail-Bestätigung, Passwortwechsel und Wiederherstellung laufen direkt über Supabase Auth." />
        </div>
      </div>
    </>
  );
}

function SignedInAccount() {
  const account = useAccount();
  const favorites = useFavorites();
  const { notify } = useToast();
  const [displayName, setDisplayName] = useState(account.profile?.display_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const user = account.user;
  if (!user) return null;
  const activeUser = user;
  const totalFavorites = favorites.market.length + favorites.merchant.length + favorites.auctions.length;
  const suspended = account.access?.status === "suspended";
  const admin = account.access?.role === "admin";

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase || suspended || !account.settings.profileUpdatesEnabled) return;
    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Ungültiger Anzeigename.", "danger");
      return;
    }
    setBusy("profile");
    const { error } = await account.supabase.rpc("update_own_profile", { p_display_name: parsed.data });
    if (!error) await account.refreshAccount();
    setBusy(null);
    notify(error ? "Der Anzeigename konnte nicht gespeichert werden." : "Profil gespeichert.", error ? "danger" : "success");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase || !activeUser.email) return;
    const parsed = passwordSchema.safeParse(newPassword);
    if (!currentPassword || !parsed.success) {
      notify(!currentPassword ? "Bitte bestätige zuerst dein aktuelles Passwort." : parsed.error?.issues[0]?.message ?? "Ungültiges Passwort.", "danger");
      return;
    }
    setBusy("password");
    const verification = await account.supabase.auth.signInWithPassword({ email: activeUser.email, password: currentPassword });
    if (verification.error || verification.data.user?.id !== activeUser.id) {
      setBusy(null);
      notify("Das aktuelle Passwort ist nicht korrekt.", "danger");
      return;
    }
    const { error } = await account.supabase.auth.updateUser({ password: parsed.data });
    setBusy(null);
    if (!error) {
      setCurrentPassword("");
      setNewPassword("");
    }
    notify(error ? authErrorMessage(error.message) : "Passwort sicher geändert.", error ? "danger" : "success");
  }

  async function signOut(scope: "local" | "global") {
    setBusy(scope === "local" ? "logout" : "logout-all");
    await account.signOut(scope);
    setBusy(null);
  }

  function exportAccount() {
    const payload = {
      export_version: 1,
      exported_at: new Date().toISOString(),
      account: {
        id: activeUser.id,
        email: activeUser.email ?? null,
        email_confirmed_at: activeUser.email_confirmed_at ?? null,
        created_at: activeUser.created_at,
        last_sign_in_at: activeUser.last_sign_in_at ?? null,
      },
      profile: account.profile,
      access: account.access,
      settings: account.settings,
      favorites: {
        market: favorites.market,
        merchant: favorites.merchant,
        auctions: favorites.auctions,
      },
    };
    downloadTextFile(`opsucht-kontodaten-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    notify("Kontodaten wurden als JSON exportiert.", "success");
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase || admin) return;
    if (deleteConfirmation !== "LÖSCHEN" || !deletePassword) {
      setDeleteMessage("Gib LÖSCHEN ein und bestätige dein aktuelles Passwort.");
      return;
    }
    setBusy("delete");
    setDeleteMessage(null);
    const result = await invokeAccountManagement(account.supabase, { action: "delete_self", password: deletePassword });
    if (!result.ok) {
      setBusy(null);
      setDeleteMessage(result.message ?? "Das Konto konnte nicht gelöscht werden.");
      return;
    }

    try {
      localStorage.removeItem(favoriteStorageKey(activeUser.id));
      localStorage.removeItem(`opsucht-favorites-v1-imported-${activeUser.id}`);
    } catch {
      // The server-side deletion already succeeded; blocked local storage is harmless.
    }
    await account.signOut("local");
    window.location.assign("/account?deleted=1");
  }

  return (
    <>
      <PageHeader eyebrow="Persönlich" title="Mein Konto" description="Profil, Sicherheit, Daten und Synchronisierung verwalten." actions={<Badge tone={admin ? "accent" : "neutral"}>{admin ? "Administrator" : "Benutzer"}</Badge>} />
      {suspended ? <div className="account-warning" role="alert">Dieses Konto wurde für persönliche Cloud-Funktionen gesperrt. Kontodaten können weiterhin exportiert oder das Konto selbst gelöscht werden.</div> : null}
      <div className="account-stats-grid">
        <AccountStat label="Synchronisierung" value={favorites.syncStatus === "synced" ? "Aktiv" : favorites.syncStatus === "error" ? "Fehler" : favorites.cloudBacked ? "Wird abgeglichen" : "Lokal"} note={favorites.cloudBacked ? "Supabase Cloud" : "Dieses Gerät"} />
        <AccountStat label="Favoriten" value={String(totalFavorites)} note={`${favorites.market.length} Markt · ${favorites.merchant.length} Händler · ${favorites.auctions.length} Auktionen`} />
        <AccountStat label="Konto erstellt" value={formatDateTime(activeUser.created_at)} note={activeUser.email ?? "Keine E-Mail verfügbar"} />
      </div>

      <div className="account-settings-grid">
        <Card>
          <CardHeader title="Profil" description="Persönliche Angaben für dieses Dashboardkonto." action={<UserRound size={18} className="section-icon" />} />
          <form className="account-form card-form" onSubmit={updateProfile}>
            <div><FieldLabel htmlFor="profile-email">E-Mail-Adresse</FieldLabel><Input id="profile-email" value={activeUser.email ?? ""} disabled /></div>
            <div><FieldLabel htmlFor="profile-name">Anzeigename</FieldLabel><Input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} disabled={suspended || !account.settings.profileUpdatesEnabled} /></div>
            {!account.settings.profileUpdatesEnabled ? <p className="form-message">Profiländerungen wurden administrativ pausiert.</p> : null}
            <Button type="submit" variant="primary" disabled={busy !== null || suspended || !account.settings.profileUpdatesEnabled}>{busy === "profile" ? "Speichert …" : "Profil speichern"}</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Kontodetails" description="Verifizierte Konto- und Aktivitätsdaten." action={<Fingerprint size={18} className="section-icon" />} />
          <dl className="account-detail-list">
            <DetailRow label="Konto-ID" value={activeUser.id} mono />
            <DetailRow label="E-Mail bestätigt" value={activeUser.email_confirmed_at ? formatDateTime(activeUser.email_confirmed_at) : "Noch nicht bestätigt"} />
            <DetailRow label="Letzte Anmeldung" value={activeUser.last_sign_in_at ? formatDateTime(activeUser.last_sign_in_at) : "Noch nie"} />
            <DetailRow label="Zuletzt aktiv" value={account.profile?.last_seen_at ? formatDateTime(account.profile.last_seen_at) : "Noch nicht erfasst"} />
            <DetailRow label="Kontostatus" value={suspended ? "Gesperrt" : "Aktiv"} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Passwort ändern" description="Sensible Änderungen erfordern das aktuelle Passwort." action={<KeyRound size={18} className="section-icon" />} />
          <form className="account-form card-form" onSubmit={updatePassword}>
            <div><FieldLabel htmlFor="current-password">Aktuelles Passwort</FieldLabel><Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></div>
            <div><FieldLabel htmlFor="new-password">Neues Passwort</FieldLabel><Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></div>
            <Button type="submit" disabled={busy !== null}>{busy === "password" ? "Ändert …" : "Passwort ändern"}</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Sitzungen" description="Steuere, auf welchen Geräten dein Konto angemeldet bleibt." action={<Smartphone size={18} className="section-icon" />} />
          <div className="card-form account-action-stack">
            <div><strong>Dieses Gerät</strong><p className="account-copy">Meldet nur den aktuellen Browser ab. Lokale Gastfavoriten bleiben erhalten.</p><Button disabled={busy !== null} onClick={() => void signOut("local")}><LogOut size={16} />{busy === "logout" ? "Meldet ab …" : "Dieses Gerät abmelden"}</Button></div>
            <div><strong>Alle Geräte</strong><p className="account-copy">Entzieht allen Geräten die erneute Sitzungsverlängerung. Bereits ausgestellte Kurzzeittokens können noch bis zu ihrem Ablauf gültig bleiben.</p><Button variant="danger" disabled={busy !== null} onClick={() => void signOut("global")}><ShieldCheck size={16} />{busy === "logout-all" ? "Beendet Sitzungen …" : "Alle Geräte abmelden"}</Button></div>
          </div>
        </Card>

        <Card className="account-data-card">
          <CardHeader title="Daten und Datenschutz" description="Exportiere deine Daten oder lösche das Konto dauerhaft." action={<Database size={18} className="section-icon" />} />
          <div className="account-data-actions">
            <article><span><Download size={18} /></span><div><strong>Kontodaten exportieren</strong><p>Erstellt eine JSON-Datei mit Profil, Zugriffsdaten und allen aktuellen Favoriten.</p></div><Button onClick={exportAccount}><Download size={15} />JSON exportieren</Button></article>
            <article className="danger-zone"><span><Trash2 size={18} /></span><div><strong>Konto dauerhaft löschen</strong><p>{admin ? "Administratorkonten müssen ihre Rolle zuerst durch einen anderen Admin übertragen lassen." : "Entfernt Auth-Konto, Profil und Cloud-Favoriten unwiderruflich."}</p></div><Button variant="danger" disabled={admin || busy !== null} onClick={() => { setDeleteOpen(true); setDeleteMessage(null); }}><Trash2 size={15} />Konto löschen</Button></article>
          </div>
        </Card>
      </div>

      <Dialog open={deleteOpen} onClose={() => { if (busy !== "delete") setDeleteOpen(false); }} title="Konto endgültig löschen" description="Diese Aktion kann nicht rückgängig gemacht werden.">
        <form className="account-form dialog-account-form" onSubmit={deleteAccount}>
          <div className="destructive-notice"><Trash2 size={20} /><p>Profil, Zugriffsdaten und Cloud-Favoriten werden dauerhaft entfernt. Exportiere deine Daten vorher, wenn du sie behalten möchtest.</p></div>
          <div><FieldLabel htmlFor="delete-password">Aktuelles Passwort</FieldLabel><Input id="delete-password" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" disabled={busy === "delete"} required /></div>
          <div><FieldLabel htmlFor="delete-confirmation">Zur Bestätigung LÖSCHEN eingeben</FieldLabel><Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" disabled={busy === "delete"} required /></div>
          {deleteMessage ? <p className="form-message" role="alert">{deleteMessage}</p> : null}
          <div className="dialog-footer-actions"><Button type="button" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>Abbrechen</Button><Button type="submit" variant="danger" disabled={busy === "delete" || deleteConfirmation !== "LÖSCHEN" || !deletePassword}><Trash2 size={15} />{busy === "delete" ? "Löscht Konto …" : "Konto unwiderruflich löschen"}</Button></div>
        </form>
      </Dialog>
    </>
  );
}

function Benefit({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <article className="account-benefit"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></article>;
}

function AccountStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <Card className="account-stat"><small>{label}</small><strong>{value}</strong><span>{note}</span></Card>;
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt>{label}</dt><dd className={mono ? "mono-value" : undefined}>{value}</dd>{label === "E-Mail bestätigt" && value !== "Noch nicht bestätigt" ? <CheckCircle2 size={14} aria-label="Bestätigt" /> : null}</div>;
}
