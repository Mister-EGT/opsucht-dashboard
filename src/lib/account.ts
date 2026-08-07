import { z } from "zod";

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Der Anzeigename muss mindestens 2 Zeichen lang sein.")
  .max(40, "Der Anzeigename darf höchstens 40 Zeichen lang sein.");

export const emailSchema = z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse ein.");

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .max(128, "Das Passwort darf höchstens 128 Zeichen lang sein.")
  .refine((value) => /[a-z]/i.test(value) && /\d/.test(value), {
    message: "Das Passwort muss mindestens einen Buchstaben und eine Zahl enthalten.",
  });

export const adminSummarySchema = z.object({
  accounts_total: z.number().nonnegative(),
  accounts_confirmed: z.number().nonnegative(),
  accounts_unconfirmed: z.number().nonnegative(),
  accounts_active: z.number().nonnegative(),
  accounts_suspended: z.number().nonnegative(),
  admins: z.number().nonnegative(),
  active_admins: z.number().nonnegative(),
  never_signed_in: z.number().nonnegative(),
  deletion_requests: z.number().nonnegative(),
  signups_24h: z.number().nonnegative(),
  signups_7d: z.number().nonnegative(),
  signups_30d: z.number().nonnegative(),
  active_24h: z.number().nonnegative(),
  active_7d: z.number().nonnegative(),
  active_30d: z.number().nonnegative(),
  favorites_total: z.number().nonnegative(),
  market_favorites: z.number().nonnegative(),
  merchant_favorites: z.number().nonnegative(),
  auction_favorites: z.number().nonnegative(),
  favorites_changed_24h: z.number().nonnegative(),
  favorites_changed_7d: z.number().nonnegative(),
  accounts_with_favorites: z.number().nonnegative(),
  average_favorites_per_account: z.number().nonnegative(),
  max_favorites_per_account: z.number().nonnegative(),
  active_sessions: z.number().nonnegative(),
  accounts_with_sessions: z.number().nonnegative(),
  audit_events_24h: z.number().nonnegative(),
  audit_events_7d: z.number().nonnegative(),
  daily_history: z.array(z.object({
    date: z.string(),
    registrations: z.number().nonnegative(),
    active_accounts: z.number().nonnegative(),
    favorites_saved: z.number().nonnegative(),
  })),
});

export const adminUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  role: z.enum(["user", "admin"]),
  status: z.enum(["active", "suspended"]),
  email_confirmed: z.boolean(),
  email_confirmed_at: z.string().nullable(),
  created_at: z.string(),
  auth_updated_at: z.string(),
  profile_updated_at: z.string(),
  access_updated_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  last_seen_at: z.string().nullable(),
  favorites_count: z.number().nonnegative(),
  market_favorites: z.number().nonnegative(),
  merchant_favorites: z.number().nonnegative(),
  auction_favorites: z.number().nonnegative(),
  last_favorite_at: z.string().nullable(),
  favorite_snapshot_bytes: z.number().nonnegative(),
  active_sessions: z.number().nonnegative(),
  last_session_at: z.string().nullable(),
  auth_providers: z.array(z.string()),
  auth_banned_until: z.string().nullable(),
  is_anonymous: z.boolean(),
  deletion_requested_at: z.string().nullable(),
});

export const adminAuditSchema = z.object({
  id: z.number().nonnegative(),
  actor_id: z.string().uuid().nullable(),
  actor_email: z.string().email().nullable(),
  action: z.string(),
  target_user_id: z.string().uuid().nullable(),
  target_email: z.string().email().nullable(),
  details: z.unknown(),
  created_at: z.string(),
});

export type AdminSummary = z.infer<typeof adminSummarySchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminAudit = z.infer<typeof adminAuditSchema>;
export type AdminAttentionFilter = "all" | "unconfirmed" | "never_signed_in" | "deletion_requested" | "active_7d";

export const accountManagementResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    action: z.enum(["delete_self", "delete_user"]),
    userId: z.string().uuid().optional(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.string(),
    message: z.string().optional(),
  }),
]);

export type AccountManagementResponse = z.infer<typeof accountManagementResponseSchema>;

export function filterAdminUsers(
  users: AdminUser[],
  query: string,
  role: "all" | "user" | "admin",
  status: "all" | "active" | "suspended",
  attention: AdminAttentionFilter = "all",
): AdminUser[] {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  return users.filter((user) => {
    if (role !== "all" && user.role !== role) return false;
    if (status !== "all" && user.status !== status) return false;
    if (attention === "unconfirmed" && user.email_confirmed) return false;
    if (attention === "never_signed_in" && user.last_sign_in_at) return false;
    if (attention === "deletion_requested" && !user.deletion_requested_at) return false;
    if (attention === "active_7d") {
      const activity = user.last_seen_at ?? user.last_sign_in_at;
      if (!activity || Date.parse(activity) < Date.now() - 7 * 24 * 60 * 60 * 1000) return false;
    }
    if (!normalized) return true;
    return [user.email, user.display_name, user.user_id]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("de-DE").includes(normalized));
  });
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  const safeText = /^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function adminUsersToCsv(users: AdminUser[]): string {
  const header = [
    "user_id", "email", "display_name", "role", "status", "email_confirmed",
    "email_confirmed_at", "created_at", "auth_updated_at", "profile_updated_at",
    "access_updated_at", "last_sign_in_at", "last_seen_at", "favorites_count",
    "market_favorites", "merchant_favorites", "auction_favorites", "last_favorite_at",
    "favorite_snapshot_bytes", "active_sessions", "last_session_at", "auth_providers",
    "auth_banned_until", "is_anonymous", "deletion_requested_at",
  ];
  const rows = users.map((user) => [
    user.user_id, user.email, user.display_name, user.role, user.status,
    user.email_confirmed, user.email_confirmed_at, user.created_at, user.auth_updated_at,
    user.profile_updated_at, user.access_updated_at, user.last_sign_in_at, user.last_seen_at,
    user.favorites_count, user.market_favorites, user.merchant_favorites, user.auction_favorites,
    user.last_favorite_at, user.favorite_snapshot_bytes, user.active_sessions, user.last_session_at,
    user.auth_providers.join(";"), user.auth_banned_until, user.is_anonymous, user.deletion_requested_at,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function filterAdminAudit(audit: AdminAudit[], query: string, action: string): AdminAudit[] {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  return audit.filter((entry) => {
    if (action !== "all" && entry.action !== action) return false;
    if (!normalized) return true;
    return [entry.action, entry.actor_email, entry.target_email, entry.actor_id, entry.target_user_id]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("de-DE").includes(normalized));
  });
}

export function adminAuditToCsv(audit: AdminAudit[]): string {
  const header = ["id", "created_at", "action", "actor_id", "actor_email", "target_user_id", "target_email", "details"];
  const rows = audit.map((entry) => [
    entry.id, entry.created_at, entry.action, entry.actor_id, entry.actor_email,
    entry.target_user_id, entry.target_email, JSON.stringify(entry.details),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeAccountRedirectPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/account";
  }
  return value;
}

export function authErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-Mail-Adresse oder Passwort sind nicht korrekt.";
  if (normalized.includes("email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  if (normalized.includes("user already registered")) return "Für diese E-Mail-Adresse existiert bereits ein Konto.";
  if (normalized.includes("password should be")) return "Das Passwort erfüllt die Sicherheitsanforderungen nicht.";
  if (normalized.includes("rate limit")) return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
  return "Die Kontoaktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.";
}
