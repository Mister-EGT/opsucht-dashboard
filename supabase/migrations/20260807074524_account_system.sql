create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.favorite_kind as enum ('market', 'merchant', 'auction');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 2 and 40
  )
);

create table public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.favorite_kind not null,
  entity_id text not null,
  snapshot jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_favorites_entity_id_length check (char_length(entity_id) between 1 and 200),
  constraint user_favorites_snapshot_shape check (snapshot is null or jsonb_typeof(snapshot) = 'object'),
  unique (user_id, kind, entity_id)
);

create index user_favorites_user_updated_idx on public.user_favorites (user_id, updated_at desc);
create index user_favorites_kind_entity_idx on public.user_favorites (kind, entity_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  public_read boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint app_settings_key_length check (char_length(key) between 1 and 80)
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_action_length check (char_length(action) between 1 and 120)
);

create index admin_audit_created_idx on public.admin_audit_log (created_at desc);

insert into public.app_settings (key, value, description, public_read)
values
  ('cloud_favorites_enabled', 'true'::jsonb, 'Geräteübergreifende Favoritensynchronisierung', true),
  ('profile_updates_enabled', 'true'::jsonb, 'Änderungen am Anzeigenamen erlauben', true);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.account_access access
      where access.user_id = (select auth.uid())
        and access.role = 'admin'::public.app_role
        and access.status = 'active'::public.account_status
    );
$$;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.account_access access
      where access.user_id = (select auth.uid())
        and access.status = 'active'::public.account_status
    );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_active_account() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_account() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger account_access_set_updated_at before update on public.account_access
for each row execute function private.set_updated_at();
create trigger user_favorites_set_updated_at before update on public.user_favorites
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_role public.app_role;
  candidate_name text;
begin
  perform pg_advisory_xact_lock(hashtext('opsucht_dashboard_initial_admin'));
  if exists (select 1 from public.account_access where role = 'admin'::public.app_role) then
    initial_role := 'user'::public.app_role;
  else
    initial_role := 'admin'::public.app_role;
  end if;

  candidate_name := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), '');
  if candidate_name is not null and char_length(candidate_name) < 2 then
    candidate_name := null;
  end if;

  insert into public.profiles (id, display_name) values (new.id, candidate_name);
  insert into public.account_access (user_id, role) values (new.id, initial_role);

  if initial_role = 'admin'::public.app_role then
    insert into public.admin_audit_log (actor_id, action, target_user_id, details)
    values (new.id, 'initial_admin_created', new.id, jsonb_build_object('source', 'first_account'));
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, display_name, created_at, updated_at, last_seen_at)
select
  users.id,
  case
    when char_length(trim(coalesce(users.raw_user_meta_data ->> 'display_name', ''))) between 2 and 40
      then trim(users.raw_user_meta_data ->> 'display_name')
    else null
  end,
  coalesce(users.created_at, now()),
  coalesce(users.updated_at, now()),
  users.last_sign_in_at
from auth.users users
on conflict (id) do nothing;

insert into public.account_access (user_id, role, created_at, updated_at)
select users.id, 'user'::public.app_role, coalesce(users.created_at, now()), coalesce(users.updated_at, now())
from auth.users users
on conflict (user_id) do nothing;

update public.account_access
set role = 'admin'::public.app_role
where user_id = (
  select users.id from auth.users users order by users.created_at asc nulls last, users.id limit 1
)
and not exists (select 1 from public.account_access where role = 'admin'::public.app_role);

alter table public.profiles enable row level security;
alter table public.account_access enable row level security;
alter table public.user_favorites enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
using ((((select auth.uid()) = id) and (select private.is_active_account())) or (select private.is_admin()))
with check ((((select auth.uid()) = id) and (select private.is_active_account())) or (select private.is_admin()));
create policy account_access_select_own_or_admin on public.account_access for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy favorites_select_own_or_admin on public.user_favorites for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy favorites_insert_own on public.user_favorites for insert to authenticated
with check ((select auth.uid()) = user_id and (select private.is_active_account()));
create policy favorites_update_own on public.user_favorites for update to authenticated
using ((select auth.uid()) = user_id and (select private.is_active_account()))
with check ((select auth.uid()) = user_id and (select private.is_active_account()));
create policy favorites_delete_own on public.user_favorites for delete to authenticated
using ((select auth.uid()) = user_id and (select private.is_active_account()));
create policy app_settings_public_read on public.app_settings for select to anon, authenticated using (public_read);
create policy app_settings_admin_read on public.app_settings for select to authenticated using ((select private.is_admin()));
create policy admin_audit_select on public.admin_audit_log for select to authenticated using ((select private.is_admin()));

grant select, update on public.profiles to authenticated;
grant select on public.account_access to authenticated;
grant select, insert, update, delete on public.user_favorites to authenticated;
grant select on public.app_settings to anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'accounts_total', (select count(*) from auth.users where deleted_at is null),
    'accounts_confirmed', (select count(*) from auth.users where deleted_at is null and email_confirmed_at is not null),
    'accounts_active', (select count(*) from public.account_access where status = 'active'::public.account_status),
    'accounts_suspended', (select count(*) from public.account_access where status = 'suspended'::public.account_status),
    'admins', (select count(*) from public.account_access where role = 'admin'::public.app_role),
    'favorites_total', (select count(*) from public.user_favorites),
    'market_favorites', (select count(*) from public.user_favorites where kind = 'market'::public.favorite_kind),
    'merchant_favorites', (select count(*) from public.user_favorites where kind = 'merchant'::public.favorite_kind),
    'auction_favorites', (select count(*) from public.user_favorites where kind = 'auction'::public.favorite_kind),
    'active_sessions', (select count(*) from auth.sessions where not_after is null or not_after > now())
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_users()
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  return query
  select users.id, users.email::text, profiles.display_name, access.role, access.status,
    users.email_confirmed_at is not null, users.created_at, users.last_sign_in_at, count(favorites.id)
  from auth.users users
  join public.profiles profiles on profiles.id = users.id
  join public.account_access access on access.user_id = users.id
  left join public.user_favorites favorites on favorites.user_id = users.id
  where users.deleted_at is null
  group by users.id, users.email, profiles.display_name, access.role, access.status,
    users.email_confirmed_at, users.created_at, users.last_sign_in_at
  order by users.created_at desc nulls last;
end;
$$;

create or replace function public.admin_list_audit(p_limit integer default 100)
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  return query
  select log.id, log.actor_id, actor.email::text, log.action, log.target_user_id,
    target.email::text, log.details, log.created_at
  from public.admin_audit_log log
  left join auth.users actor on actor.id = log.actor_id
  left join auth.users target on target.id = log.target_user_id
  order by log.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_role public.app_role,
  p_status public.account_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare old_access public.account_access%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Das eigene Adminkonto kann hier nicht verändert werden' using errcode = '22023';
  end if;
  select * into old_access from public.account_access where user_id = p_user_id for update;
  if not found then raise exception 'Konto nicht gefunden' using errcode = 'P0002'; end if;
  if old_access.role = 'admin'::public.app_role
     and old_access.status = 'active'::public.account_status
     and (p_role <> 'admin'::public.app_role or p_status <> 'active'::public.account_status)
     and (select count(*) from public.account_access
          where role = 'admin'::public.app_role and status = 'active'::public.account_status) <= 1 then
    raise exception 'Der letzte aktive Admin kann nicht entfernt oder gesperrt werden' using errcode = '22023';
  end if;
  update public.account_access set role = p_role, status = p_status where user_id = p_user_id;
  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values ((select auth.uid()), 'account_access_updated', p_user_id, jsonb_build_object(
    'old_role', old_access.role, 'new_role', p_role,
    'old_status', old_access.status, 'new_status', p_status
  ));
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous_value jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  if p_key not in ('cloud_favorites_enabled', 'profile_updates_enabled') then
    raise exception 'Unbekannte oder nicht änderbare Einstellung' using errcode = '22023';
  end if;
  if jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'Diese Einstellung erwartet einen booleschen Wert' using errcode = '22023';
  end if;
  select value into previous_value from public.app_settings where key = p_key for update;
  if not found then raise exception 'Einstellung nicht gefunden' using errcode = 'P0002'; end if;
  update public.app_settings
  set value = p_value, updated_by = (select auth.uid()), updated_at = now()
  where key = p_key;
  insert into public.admin_audit_log (actor_id, action, details)
  values ((select auth.uid()), 'setting_updated', jsonb_build_object(
    'key', p_key, 'old_value', previous_value, 'new_value', p_value
  ));
end;
$$;

revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_list_audit(integer) from public;
revoke all on function public.admin_set_user_access(uuid, public.app_role, public.account_status) from public;
revoke all on function public.admin_update_setting(text, jsonb) from public;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_list_audit(integer) to authenticated;
grant execute on function public.admin_set_user_access(uuid, public.app_role, public.account_status) to authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
