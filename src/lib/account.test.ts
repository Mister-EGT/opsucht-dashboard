import { describe, expect, it } from "vitest";
import { accountManagementResponseSchema, adminUsersToCsv, authErrorMessage, displayNameSchema, filterAdminUsers, passwordSchema, safeAccountRedirectPath, type AdminUser } from "@/lib/account";

const users: AdminUser[] = [
  {
    user_id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    display_name: "Morell",
    role: "admin",
    status: "active",
    email_confirmed: true,
    created_at: "2026-08-07T08:00:00Z",
    last_sign_in_at: "2026-08-07T09:00:00Z",
    last_seen_at: "2026-08-07T09:05:00Z",
    favorites_count: 3,
    market_favorites: 1,
    merchant_favorites: 1,
    auction_favorites: 1,
    deletion_requested_at: null,
  },
  {
    user_id: "00000000-0000-4000-8000-000000000002",
    email: "user@example.com",
    display_name: "Testnutzer",
    role: "user",
    status: "suspended",
    email_confirmed: false,
    created_at: "2026-08-07T08:30:00Z",
    last_sign_in_at: null,
    last_seen_at: null,
    favorites_count: 0,
    market_favorites: 0,
    merchant_favorites: 0,
    auction_favorites: 0,
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
    expect(filterAdminUsers(users, "nicht-vorhanden", "all", "all")).toEqual([]);
  });

  it("exportiert gefilterte Konten als maskierte CSV-Zellen", () => {
    const csv = adminUsersToCsv([{ ...users[0]!, display_name: 'Name, "mit Komma"', email: "=HYPERLINK(\"https://example.com\")" }]);
    expect(csv).toContain('"Name, ""mit Komma"""');
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).toContain('"market_favorites"');
  });

  it("validiert Antworten der privilegierten Kontoverwaltung defensiv", () => {
    expect(accountManagementResponseSchema.safeParse({ ok: true, action: "delete_self" }).success).toBe(true);
    expect(accountManagementResponseSchema.safeParse({ ok: false, code: "suspension_required", message: "Erst sperren" }).success).toBe(true);
    expect(accountManagementResponseSchema.safeParse({ ok: true, action: "promote_user" }).success).toBe(false);
  });
});
