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
  accounts_active: z.number().nonnegative(),
  accounts_suspended: z.number().nonnegative(),
  admins: z.number().nonnegative(),
  favorites_total: z.number().nonnegative(),
  market_favorites: z.number().nonnegative(),
  merchant_favorites: z.number().nonnegative(),
  auction_favorites: z.number().nonnegative(),
  active_sessions: z.number().nonnegative(),
});

export const adminUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  role: z.enum(["user", "admin"]),
  status: z.enum(["active", "suspended"]),
  email_confirmed: z.boolean(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  favorites_count: z.number().nonnegative(),
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
