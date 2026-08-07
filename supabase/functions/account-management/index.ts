import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeleteRequest =
  | { action: "delete_self"; password?: unknown }
  | { action: "delete_user"; userId?: unknown };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function namedKey(variable: string): string | null {
  const raw = Deno.env.get(variable);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.default === "string" ? parsed.default : null;
  } catch {
    return null;
  }
}

function auditDetails(actorEmail: string | null, targetEmail: string | null, targetUserId: string) {
  return {
    actor_email: actorEmail,
    target_email: targetEmail,
    target_user_id: targetUserId,
    source: "account-management-edge-function",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = namedKey("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? namedKey("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("Supabase function keys are not available.");
    return json({ ok: false, code: "configuration_error", message: "Kontoverwaltung ist derzeit nicht verfügbar." }, 503);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return json({ ok: false, code: "unauthorized", message: "Bitte melde dich erneut an." }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  const actor = authData.user;
  if (authError || !actor) return json({ ok: false, code: "unauthorized", message: "Die Sitzung ist nicht mehr gültig." }, 401);

  let body: DeleteRequest;
  try {
    body = await request.json() as DeleteRequest;
  } catch {
    return json({ ok: false, code: "invalid_request", message: "Die Anfrage ist ungültig." }, 400);
  }

  const { data: actorAccess, error: actorAccessError } = await admin
    .from("account_access")
    .select("role,status")
    .eq("user_id", actor.id)
    .maybeSingle();
  if (actorAccessError || !actorAccess) {
    return json({ ok: false, code: "account_unavailable", message: "Das Konto ist nicht verfügbar." }, 403);
  }

  if (body.action === "delete_self") {
    if (actorAccess.role === "admin") {
      return json({
        ok: false,
        code: "admin_self_delete_blocked",
        message: "Administratorkonten müssen ihre Rolle zuerst von einem anderen Admin übertragen lassen.",
      }, 409);
    }
    if (!actor.email || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 128) {
      return json({ ok: false, code: "password_required", message: "Bitte bestätige dein aktuelles Passwort." }, 400);
    }

    const verifier = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
      email: actor.email,
      password: body.password,
    });
    if (verifyError || verified.user?.id !== actor.id) {
      return json({ ok: false, code: "reauthentication_failed", message: "Das aktuelle Passwort ist nicht korrekt." }, 403);
    }
    await verifier.auth.signOut({ scope: "local" });

    const details = auditDetails(actor.email, actor.email, actor.id);
    const { error: auditError } = await admin.from("admin_audit_log").insert({
      actor_id: actor.id,
      action: "account_self_delete_requested",
      target_user_id: actor.id,
      details,
    });
    if (auditError) {
      console.error("Self-delete audit failed", auditError.code);
      return json({ ok: false, code: "audit_failed", message: "Die Löschung konnte nicht sicher protokolliert werden." }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(actor.id);
    if (deleteError) {
      await admin.from("admin_audit_log").insert({
        actor_id: actor.id,
        action: "account_self_delete_failed",
        target_user_id: actor.id,
        details: { ...details, error_code: deleteError.code ?? "unknown" },
      });
      console.error("Self-delete failed", deleteError.code);
      return json({ ok: false, code: "delete_failed", message: "Das Konto konnte nicht gelöscht werden. Bitte versuche es später erneut." }, 500);
    }

    return json({ ok: true, action: "delete_self" });
  }

  if (body.action === "delete_user") {
    if (actorAccess.role !== "admin" || actorAccess.status !== "active") {
      return json({ ok: false, code: "admin_required", message: "Aktive Adminberechtigung erforderlich." }, 403);
    }
    if (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
      return json({ ok: false, code: "invalid_user_id", message: "Ungültige Konto-ID." }, 400);
    }
    if (body.userId === actor.id) {
      return json({ ok: false, code: "self_admin_delete_blocked", message: "Das eigene Adminkonto kann hier nicht gelöscht werden." }, 409);
    }

    const { data: targetAccess, error: targetAccessError } = await admin
      .from("account_access")
      .select("user_id,role,status,deletion_requested_at")
      .eq("user_id", body.userId)
      .maybeSingle();
    if (targetAccessError || !targetAccess) {
      return json({ ok: false, code: "account_not_found", message: "Das Konto wurde nicht gefunden." }, 404);
    }
    if (targetAccess.status !== "suspended") {
      return json({ ok: false, code: "suspension_required", message: "Das Konto muss vor der Löschung gesperrt werden." }, 409);
    }
    if (targetAccess.deletion_requested_at) {
      return json({ ok: false, code: "deletion_in_progress", message: "Für dieses Konto läuft bereits eine Löschung." }, 409);
    }

    const requestedAt = new Date().toISOString();
    const { data: lockedTarget, error: lockError } = await admin
      .from("account_access")
      .update({ deletion_requested_at: requestedAt, deletion_requested_by: actor.id })
      .eq("user_id", body.userId)
      .eq("status", "suspended")
      .is("deletion_requested_at", null)
      .select("user_id")
      .maybeSingle();
    if (lockError || !lockedTarget) {
      return json({ ok: false, code: "account_changed", message: "Der Kontostatus hat sich geändert. Bitte lade die Ansicht neu." }, 409);
    }

    const { data: targetAuth } = await admin.auth.admin.getUserById(body.userId);
    const targetEmail = targetAuth.user?.email ?? null;
    const details = auditDetails(actor.email ?? null, targetEmail, body.userId);
    const { error: auditError } = await admin.from("admin_audit_log").insert({
      actor_id: actor.id,
      action: "admin_account_delete_requested",
      target_user_id: body.userId,
      details,
    });
    if (auditError) {
      await admin.from("account_access").update({ deletion_requested_at: null, deletion_requested_by: null }).eq("user_id", body.userId);
      console.error("Admin-delete audit failed", auditError.code);
      return json({ ok: false, code: "audit_failed", message: "Die Löschung konnte nicht sicher protokolliert werden." }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(body.userId);
    if (deleteError) {
      await admin.from("account_access").update({ deletion_requested_at: null, deletion_requested_by: null }).eq("user_id", body.userId);
      await admin.from("admin_audit_log").insert({
        actor_id: actor.id,
        action: "admin_account_delete_failed",
        target_user_id: body.userId,
        details: { ...details, error_code: deleteError.code ?? "unknown" },
      });
      console.error("Admin-delete failed", deleteError.code);
      return json({ ok: false, code: "delete_failed", message: "Das Konto konnte nicht gelöscht werden. Bitte versuche es später erneut." }, 500);
    }

    return json({ ok: true, action: "delete_user", userId: body.userId });
  }

  return json({ ok: false, code: "unknown_action", message: "Unbekannte Kontoaktion." }, 400);
});
