import { describe, expect, it } from "vitest";
import { accountManagementResponseSchema, adminAuditToCsv, adminSummarySchema, adminUsersToCsv, authErrorMessage, displayNameSchema, filterAdminAudit, filterAdminUsers, passwordSchema, safeAccountRedirectPath, type AdminAudit, type AdminUser } from "@/lib/account";

const users: AdminUser[] = [
  {
    user_id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    display_name: "Morell",
    role: "admin",
    status: "active",
    email_confirmed: true,
    email_confirmed_at: "2026-08-07T08:01:00Z",
    created_at: "2026-08-07T08:00:00Z",
    auth_updated_at: "2026-08-07T09:00:00Z",
    profile_updated_at: "2026-08-07T09:05:00Z",
    access_updated_at: "2026-08-07T08:00:00Z",
    last_sign_in_at: "2026-08-07T09:00:00Z",
    last_seen_at: "2026-08-07T09:05:00Z",
    favorites_count: 3,
    market_favorites: 1,
    merchant_favorites: 1,
    auction_favorites: 1,
    last_favorite_at: "2026-08-07T09:04:00Z",
    favorite_snapshot_bytes: 512,
    active_sessions: 2,
    last_session_at: "2026-08-07T09:00:00Z",
    auth_providers: ["email"],
    auth_banned_until: null,
    is_anonymous: false,
    deletion_requested_at: null,
  },
  {
    user_id: "00000000-0000-4000-8000-000000000002",
    email: "user@example.com",
    display_name: "Testnutzer",
    role: "user",
    status: "suspended",
    email_confirmed: false,
    email_confirmed_at: null,
    created_at: "2026-08-07T08:30:00Z",
    auth_updated_at: "2026-08-07T08:30:00Z",
    profile_updated_at: "2026-08-07T08:30:00Z",
    access_updated_at: "2026-08-07T08:40:00Z",
    last_sign_in_at: null,
    last_seen_at: null,
    favorites_count: 0,
    market_favorites: 0,
    merchant_favorites: 0,
    auction_favorites: 0,
    last_favorite_at: null,
    favorite_snapshot_bytes: 0,
    active_sessions: 0,
    last_session_at: null,
    auth_providers: ["email"],
    auth_banned_until: null,
    is_anonymous: false,
    deletion_requested_at: null,
  },
];

describe("Kontovalidierung", () => {
  it("normalisiert gültige Anzeigenamen", () => {
    expect(displayNameSchema.parse("  Morell  ")).toBe("Morell");
  });

  it("lehnt zu kurze Anzeigenamen ab", () => {
    expect(displayNameSchema.safeParse("M").success).toBe(false);
  });

  it("verlangt bei Passwörtern Buchstaben und Zahlen", () => {
    expect(passwordSchema.safeParse("nur-buchstaben").success).toBe(false);
    expect(passwordSchema.safeParse("sicheres-passwort-2026").success).toBe(true);
  });

  it("übersetzt bekannte Auth-Fehler ohne interne Details", () => {
    expect(authErrorMessage("Invalid login credentials")).toContain("nicht korrekt");
    expect(authErrorMessage("unexpected internal provider state")).not.toContain("provider");
  });

  it("erlaubt beim Auth-Callback ausschließlich lokale Redirects", () => {
    expect(safeAccountRedirectPath("/favorites?cloud=1")).toBe("/favorites?cloud=1");
    expect(safeAccountRedirectPath("https://example.com")).toBe("/account");
    expect(safeAccountRedirectPath("//example.com")).toBe("/account");
    expect(safeAccountRedirectPath("/\\example.com")).toBe("/account");
  });

  it("filtert die Admin-Kontenansicht nach Suche, Rolle und Status", () => {
    expect(filterAdminUsers(users, "morell", "all", "all")).toEqual([users[0]]);
    expect(filterAdminUsers(users, "", "user", "suspended")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "", "all", "all", "unconfirmed")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "", "all", "all", "never_signed_in")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "nicht-vorhanden", "all", "all")).toEqual([]);
  });

  it("exportiert gefilterte Konten als maskierte CSV-Zellen", () => {
    const csv = adminUsersToCsv([{ ...users[0]!, display_name: 'Name, "mit Komma"', email: "=HYPERLINK(\"https://example.com\")" }]);
    expect(csv).toContain('"Name, ""mit Komma"""');
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).toContain('"market_favorites"');
    expect(csv).toContain('"active_sessions"');
    expect(csv).toContain('"auth_providers"');
  });

  it("validiert die erweiterte Adminübersicht mit Tagesverlauf", () => {
    const parsed = adminSummarySchema.safeParse({
      accounts_total: 2, accounts_confirmed: 1, accounts_unconfirmed: 1,
      accounts_active: 1, accounts_suspended: 1, admins: 1, active_admins: 1,
      never_signed_in: 1, deletion_requests: 0, signups_24h: 2, signups_7d: 2,
      signups_30d: 2, active_24h: 1, active_7d: 1, active_30d: 1,
      favorites_total: 3, market_favorites: 1, merchant_favorites: 1,
      auction_favorites: 1, favorites_changed_24h: 3, favorites_changed_7d: 3,
      accounts_with_favorites: 1, average_favorites_per_account: 3,
      max_favorites_per_account: 3, active_sessions: 2, accounts_with_sessions: 1,
      audit_events_24h: 0, audit_events_7d: 1,
      daily_history: [{ date: "2026-08-07", registrations: 2, active_accounts: 1, favorites_saved: 3 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("filtert und exportiert das Adminprotokoll", () => {
    const entries: AdminAudit[] = [{
      id: 1,
      actor_id: users[0]!.user_id,
      actor_email: users[0]!.email,
      action: "setting_updated",
      target_user_id: null,
      target_email: null,
      details: { key: "cloud_favorites_enabled", value: true },
      created_at: "2026-08-07T09:10:00Z",
    }];
    expect(filterAdminAudit(entries, "admin@example.com", "all")).toEqual(entries);
    expect(filterAdminAudit(entries, "", "account_access_updated")).toEqual([]);
    expect(adminAuditToCsv(entries)).toContain('"cloud_favorites_enabled"');
  });

  it("validiert Antworten der privilegierten Kontoverwaltung defensiv", () => {
    expect(accountManagementResponseSchema.safeParse({ ok: true, action: "delete_self" }).success).toBe(true);
    expect(accountManagementResponseSchema.safeParse({ ok: false, code: "suspension_required", message: "Erst sperren" }).success).toBe(true);
    expect(accountManagementResponseSchema.safeParse({ ok: true, action: "promote_user" }).success).toBe(false);
  });
});
