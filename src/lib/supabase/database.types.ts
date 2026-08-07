export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      account_access: {
        Row: {
          created_at: string;
          deletion_requested_at: string | null;
          deletion_requested_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_requested_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_requested_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          target_user_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          description: string;
          key: string;
          public_read: boolean;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description: string;
          key: string;
          public_read?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string;
          key?: string;
          public_read?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          last_seen_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          last_seen_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_favorites: {
        Row: {
          entity_id: string;
          id: string;
          kind: Database["public"]["Enums"]["favorite_kind"];
          saved_at: string;
          snapshot: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          entity_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["favorite_kind"];
          saved_at?: string;
          snapshot?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          entity_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["favorite_kind"];
          saved_at?: string;
          snapshot?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      admin_dashboard: { Args: never; Returns: Json };
      admin_list_audit: {
        Args: { p_limit?: number };
        Returns: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          target_email: string | null;
          target_user_id: string | null;
        }[];
      };
      admin_list_users: {
        Args: never;
        Returns: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          email_confirmed: boolean;
          favorites_count: number;
          last_sign_in_at: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["account_status"];
          user_id: string;
        }[];
      };
      admin_list_users_v2: {
        Args: never;
        Returns: {
          auction_favorites: number;
          created_at: string;
          deletion_requested_at: string | null;
          display_name: string | null;
          email: string | null;
          email_confirmed: boolean;
          favorites_count: number;
          last_seen_at: string | null;
          last_sign_in_at: string | null;
          market_favorites: number;
          merchant_favorites: number;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["account_status"];
          user_id: string;
        }[];
      };
      admin_set_user_access: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"];
          p_status: Database["public"]["Enums"]["account_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_update_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      touch_own_profile: { Args: never; Returns: undefined };
      update_own_profile: {
        Args: { p_display_name: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_status: "active" | "suspended";
      app_role: "user" | "admin";
      favorite_kind: "market" | "merchant" | "auction";
    };
    CompositeTypes: Record<never, never>;
  };
};

export type AccountAccess = Database["public"]["Tables"]["account_access"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type FavoriteRow = Database["public"]["Tables"]["user_favorites"]["Row"];
