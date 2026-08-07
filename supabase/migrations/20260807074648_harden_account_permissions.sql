revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.account_access from anon, authenticated;
revoke all privileges on table public.user_favorites from anon, authenticated;
revoke all privileges on table public.app_settings from anon, authenticated;
revoke all privileges on table public.admin_audit_log from anon, authenticated;
revoke all privileges on sequence public.admin_audit_log_id_seq from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.account_access to authenticated;
grant select, insert, update, delete on public.user_favorites to authenticated;
grant select on public.app_settings to anon, authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy app_settings_public_read on public.app_settings;
drop policy app_settings_admin_read on public.app_settings;

create policy app_settings_anon_public_read on public.app_settings
for select to anon using (public_read);
create policy app_settings_authenticated_read on public.app_settings
for select to authenticated using (public_read or (select private.is_admin()));

create index admin_audit_actor_idx on public.admin_audit_log (actor_id);
create index admin_audit_target_idx on public.admin_audit_log (target_user_id);
create index app_settings_updated_by_idx on public.app_settings (updated_by);

revoke execute on function public.admin_dashboard() from public, anon, authenticated;
revoke execute on function public.admin_list_users() from public, anon, authenticated;
revoke execute on function public.admin_list_audit(integer) from public, anon, authenticated;
revoke execute on function public.admin_set_user_access(uuid, public.app_role, public.account_status) from public, anon, authenticated;
revoke execute on function public.admin_update_setting(text, jsonb) from public, anon, authenticated;

alter function public.admin_dashboard() set schema private;
alter function public.admin_list_users() set schema private;
alter function public.admin_list_audit(integer) set schema private;
alter function public.admin_set_user_access(uuid, public.app_role, public.account_status) set schema private;
alter function public.admin_update_setting(text, jsonb) set schema private;

revoke all on function private.admin_dashboard() from public, anon;
revoke all on function private.admin_list_users() from public, anon;
revoke all on function private.admin_list_audit(integer) from public, anon;
revoke all on function private.admin_set_user_access(uuid, public.app_role, public.account_status) from public, anon;
revoke all on function private.admin_update_setting(text, jsonb) from public, anon;
grant execute on function private.admin_dashboard() to authenticated;
grant execute on function private.admin_list_users() to authenticated;
grant execute on function private.admin_list_audit(integer) to authenticated;
grant execute on function private.admin_set_user_access(uuid, public.app_role, public.account_status) to authenticated;
grant execute on function private.admin_update_setting(text, jsonb) to authenticated;

create function public.admin_dashboard()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_dashboard(); $$;

create function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.account_status,
  email_confirmed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  favorites_count bigint
)
language sql security invoker set search_path = ''
as $$ select * from private.admin_list_users(); $$;

create function public.admin_list_audit(p_limit integer default 100)
returns table (
  id bigint,
  actor_id uuid,
  actor_email text,
  action text,
  target_user_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.admin_list_audit(p_limit); $$;

create function public.admin_set_user_access(
  p_user_id uuid,
  p_role public.app_role,
  p_status public.account_status
)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_user_access(p_user_id, p_role, p_status); $$;

create function public.admin_update_setting(p_key text, p_value jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_update_setting(p_key, p_value); $$;

revoke all on function public.admin_dashboard() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_list_audit(integer) from public, anon;
revoke all on function public.admin_set_user_access(uuid, public.app_role, public.account_status) from public, anon;
revoke all on function public.admin_update_setting(text, jsonb) from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_list_audit(integer) to authenticated;
grant execute on function public.admin_set_user_access(uuid, public.app_role, public.account_status) to authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
