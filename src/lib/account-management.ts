import type { SupabaseClient } from "@supabase/supabase-js";
import { accountManagementResponseSchema, type AccountManagementResponse } from "@/lib/account";
import type { Database } from "@/lib/supabase/database.types";

export type AccountManagementRequest =
  | { action: "delete_self"; password: string }
  | { action: "delete_user"; userId: string };

const fallbackResponse: AccountManagementResponse = {
  ok: false,
  code: "request_failed",
  message: "Die Kontoaktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
};

export async function invokeAccountManagement(
  supabase: SupabaseClient<Database>,
  body: AccountManagementRequest,
): Promise<AccountManagementResponse> {
  const { data, error } = await supabase.functions.invoke("account-management", { body });
  const parsedData = accountManagementResponseSchema.safeParse(data);
  if (parsedData.success) return parsedData.data;

  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const parsedError = accountManagementResponseSchema.safeParse(await context.clone().json());
      if (parsedError.success) return parsedError.data;
    } catch {
      // Network and gateway errors deliberately use the generic fallback below.
    }
  }

  return fallbackResponse;
}
