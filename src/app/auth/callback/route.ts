import { NextResponse } from "next/server";
import { safeAccountRedirectPath } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAccountRedirectPath(url.searchParams.get("next"));
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/account?error=configuration", url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, url.origin));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }

  return NextResponse.redirect(new URL("/account?error=callback", url.origin));
}
