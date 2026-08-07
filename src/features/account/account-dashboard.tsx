"use client";

import { Cloud, KeyRound, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAccount } from "@/components/account-provider";
import { useFavorites } from "@/components/favorites-provider";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/form";
import { PageSkeleton } from "@/components/ui/states";
import { authErrorMessage, displayNameSchema, emailSchema, passwordSchema } from "@/lib/account";
import { formatDateTime } from "@/lib/format";

type AuthMode = "login" | "signup";

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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"profile" | "password" | "logout" | null>(null);
  const totalFavorites = favorites.market.length + favorites.merchant.length + favorites.auctions.length;
  const suspended = account.access?.status === "suspended";

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase || !account.user || suspended || !account.settings.profileUpdatesEnabled) return;
    const parsed = displayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Ungültiger Anzeigename.", "danger");
      return;
    }
    setBusy("profile");
    const { error } = await account.supabase.from("profiles").update({ display_name: parsed.data }).eq("id", account.user.id);
    if (!error) await account.refreshAccount();
    setBusy(null);
    notify(error ? "Der Anzeigename konnte nicht gespeichert werden." : "Profil gespeichert.", error ? "danger" : "success");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Ungültiges Passwort.", "danger");
      return;
    }
    setBusy("password");
    const { error } = await account.supabase.auth.updateUser({ password: parsed.data });
    setBusy(null);
    if (!error) setPassword("");
    notify(error ? authErrorMessage(error.message) : "Passwort geändert.", error ? "danger" : "success");
  }

  async function signOut() {
    setBusy("logout");
    await account.signOut();
    setBusy(null);
  }

  return (
    <>
      <PageHeader eyebrow="Persönlich" title="Mein Konto" description="Profil, Sicherheit und Synchronisierung verwalten." actions={<Badge tone={account.access?.role === "admin" ? "accent" : "neutral"}>{account.access?.role === "admin" ? "Administrator" : "Benutzer"}</Badge>} />
      {suspended ? <div className="account-warning" role="alert">Dieses Konto wurde für persönliche Cloud-Funktionen gesperrt. Öffentliche Dashboarddaten bleiben weiterhin verfügbar.</div> : null}
      <div className="account-stats-grid">
        <AccountStat label="Synchronisierung" value={favorites.syncStatus === "synced" ? "Aktiv" : favorites.syncStatus === "error" ? "Fehler" : favorites.cloudBacked ? "Wird abgeglichen" : "Lokal"} note={favorites.cloudBacked ? "Supabase Cloud" : "Dieses Gerät"} />
        <AccountStat label="Favoriten" value={String(totalFavorites)} note="Markt, Händler und Auktionen" />
        <AccountStat label="Konto erstellt" value={formatDateTime(account.user?.created_at)} note={account.user?.email ?? "Keine E-Mail verfügbar"} />
      </div>
      <div className="account-settings-grid">
        <Card>
          <CardHeader title="Profil" description="Der Anzeigename wird im Dashboard verwendet." action={<UserRound size={18} className="section-icon" />} />
          <form className="account-form card-form" onSubmit={updateProfile}>
            <div><FieldLabel htmlFor="profile-email">E-Mail-Adresse</FieldLabel><Input id="profile-email" value={account.user?.email ?? ""} disabled /></div>
            <div><FieldLabel htmlFor="profile-name">Anzeigename</FieldLabel><Input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} disabled={suspended || !account.settings.profileUpdatesEnabled} /></div>
            {!account.settings.profileUpdatesEnabled ? <p className="form-message">Profiländerungen wurden administrativ pausiert.</p> : null}
            <Button type="submit" variant="primary" disabled={busy !== null || suspended || !account.settings.profileUpdatesEnabled}>{busy === "profile" ? "Speichert …" : "Profil speichern"}</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Sicherheit" description="Ein neues Passwort gilt sofort für dieses Konto." action={<KeyRound size={18} className="section-icon" />} />
          <form className="account-form card-form" onSubmit={updatePassword}>
            <div><FieldLabel htmlFor="new-password">Neues Passwort</FieldLabel><Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} /></div>
            <Button type="submit" disabled={busy !== null}>{busy === "password" ? "Ändert …" : "Passwort ändern"}</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Sitzung" description="Melde dieses Gerät vom Dashboardkonto ab." action={<LogOut size={18} className="section-icon" />} />
          <div className="card-form"><p className="account-copy">Nach der Abmeldung werden wieder die lokalen Gastfavoriten dieses Browsers angezeigt.</p><Button variant="danger" disabled={busy !== null} onClick={signOut}><LogOut size={16} />{busy === "logout" ? "Meldet ab …" : "Abmelden"}</Button></div>
        </Card>
      </div>
    </>
  );
}

function Benefit({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <article className="account-benefit"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></article>;
}

function AccountStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <Card className="account-stat"><small>{label}</small><strong>{value}</strong><span>{note}</span></Card>;
}
