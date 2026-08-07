"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccountAccess, Database, Profile } from "@/lib/supabase/database.types";

interface AccountSettings {
  cloudFavoritesEnabled: boolean;
  profileUpdatesEnabled: boolean;
}

interface AccountContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  access: AccountAccess | null;
  settings: AccountSettings;
  supabase: SupabaseClient<Database> | null;
  displayName: string;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultSettings: AccountSettings = {
  cloudFavoritesEnabled: true,
  profileUpdatesEnabled: true,
};

const AccountContext = createContext<AccountContextValue | null>(null);

function readSettings(rows: { key: string; value: unknown }[] | null): AccountSettings {
  const values = new Map(rows?.map((row) => [row.key, row.value]) ?? []);
  return {
    cloudFavoritesEnabled: values.get("cloud_favorites_enabled") !== false,
    profileUpdatesEnabled: values.get("profile_updates_enabled") !== false,
  };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(Boolean(supabase));
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const [settings, setSettings] = useState<AccountSettings>(defaultSettings);

  const loadAccount = useCallback(async (knownUser?: User | null) => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const currentUser = knownUser === undefined
      ? (await supabase.auth.getUser()).data.user
      : knownUser;
    setUser(currentUser);

    const settingsRequest = supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["cloud_favorites_enabled", "profile_updates_enabled"]);

    if (!currentUser) {
      const { data } = await settingsRequest;
      setSettings(readSettings(data));
      setProfile(null);
      setAccess(null);
      setLoading(false);
      return;
    }

    const [profileResult, accessResult, settingsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
      supabase.from("account_access").select("*").eq("user_id", currentUser.id).maybeSingle(),
      settingsRequest,
    ]);

    setProfile(profileResult.data);
    setAccess(accessResult.data);
    setSettings(readSettings(settingsResult.data));
    setLoading(false);

    if (profileResult.data && accessResult.data?.status === "active") {
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", currentUser.id);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const initialLoad = window.setTimeout(() => {
      void loadAccount().catch(() => {
        if (active) setLoading(false);
      });
    }, 0);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      window.setTimeout(() => {
        if (active) void loadAccount(session?.user ?? null);
      }, 0);
    });

    return () => {
      active = false;
      window.clearTimeout(initialLoad);
      data.subscription.unsubscribe();
    };
  }, [loadAccount, supabase]);

  const refreshAccount = useCallback(async () => {
    setLoading(true);
    await loadAccount();
  }, [loadAccount]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "local" });
    setUser(null);
    setProfile(null);
    setAccess(null);
  }, [supabase]);

  const displayName = profile?.display_name
    ?? user?.email?.split("@")[0]
    ?? "Konto";

  const value = useMemo<AccountContextValue>(() => ({
    configured: Boolean(supabase),
    loading,
    user,
    profile,
    access,
    settings,
    supabase,
    displayName,
    refreshAccount,
    signOut,
  }), [access, displayName, loading, profile, refreshAccount, settings, signOut, supabase, user]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount muss innerhalb des AccountProvider verwendet werden.");
  return context;
}
