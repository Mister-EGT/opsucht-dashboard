alter table public.account_access
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references auth.users(id) on delete set null;

create index account_access_deletion_requested_idx
  on public.account_access (deletion_requested_at)
  where deletion_requested_at is not null;

create or replace function private.setting_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select setting.value = 'true'::jsonb
     from public.app_settings setting
     where setting.key = p_key),
    false
  );
$$;

revoke all on function private.setting_enabled(text) from public, anon;
grant execute on function private.setting_enabled(text) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
begin
  candidate_name := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), '');
  if candidate_name is not null and char_length(candidate_name) < 2 then
    candidate_name := null;
  end if;

  insert into public.profiles (id, display_name) values (new.id, candidate_name);
  insert into public.account_access (user_id, role, status)
  values (new.id, 'user'::public.app_role, 'active'::public.account_status);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.bootstrap_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('opsucht_dashboard_admin_bootstrap'));
  if exists (
    select 1 from public.account_access
    where role = 'admin'::public.app_role
  ) then
    raise exception 'Ein Administratorkonto ist bereits eingerichtet' using errcode = '22023';
  end if;

  select users.id into target_id
  from auth.users users
  where lower(users.email::text) = lower(trim(p_email))
    and users.deleted_at is null
    and users.email_confirmed_at is not null
  order by users.created_at asc
  limit 1;

  if target_id is null then
    raise exception 'Kein bestätigtes Konto mit dieser E-Mail-Adresse gefunden' using errcode = 'P0002';
  end if;

  update public.account_access
  set role = 'admin'::public.app_role,
      status = 'active'::public.account_status
  where user_id = target_id;

  insert into public.admin_audit_log (action, target_user_id, details)
  values ('admin_bootstrapped', target_id, jsonb_build_object('method', 'database_owner'));
  return target_id;
end;
$$;

revoke all on function private.bootstrap_admin(text) from public, anon, authenticated, service_role;

drop policy profiles_update_own_or_admin on public.profiles;
revoke update on public.profiles from authenticated;

create or replace function private.update_own_profile(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text := trim(p_display_name);
begin
  if (select auth.uid()) is null or not (select private.is_active_account()) then
    raise exception 'Aktives Konto erforderlich' using errcode = '42501';
  end if;
  if not (select private.setting_enabled('profile_updates_enabled')) then
    raise exception 'Profiländerungen sind derzeit pausiert' using errcode = '42501';
  end if;
  if char_length(candidate_name) not between 2 and 40 then
    raise exception 'Der Anzeigename muss 2 bis 40 Zeichen lang sein' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = candidate_name
  where id = (select auth.uid());
  if not found then
    raise exception 'Profil nicht gefunden' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function private.touch_own_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_active_account()) then
    return;
  end if;
  update public.profiles
  set last_seen_at = now()
  where id = (select auth.uid())
    and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
end;
$$;

revoke all on function private.update_own_profile(text) from public, anon;
revoke all on function private.touch_own_profile() from public, anon;
grant execute on function private.update_own_profile(text) to authenticated;
grant execute on function private.touch_own_profile() to authenticated;

create function public.update_own_profile(p_display_name text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.update_own_profile(p_display_name); $$;

create function public.touch_own_profile()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.touch_own_profile(); $$;

revoke all on function public.update_own_profile(text) from public, anon;
revoke all on function public.touch_own_profile() from public, anon;
grant execute on function public.update_own_profile(text) to authenticated;
grant execute on function public.touch_own_profile() to authenticated;

drop policy favorites_select_own_or_admin on public.user_favorites;
drop policy favorites_insert_own on public.user_favorites;
drop policy favorites_update_own on public.user_favorites;
drop policy favorites_delete_own on public.user_favorites;

create policy favorites_select_active_own_or_admin on public.user_favorites
for select to authenticated
using (
  (
    (select auth.uid()) = user_id
    and (select private.is_active_account())
    and (select private.setting_enabled('cloud_favorites_enabled'))
  )
  or (select private.is_admin())
);

create policy favorites_insert_active_own on public.user_favorites
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_active_account())
  and (select private.setting_enabled('cloud_favorites_enabled'))
);

create policy favorites_update_active_own on public.user_favorites
for update to authenticated
using (
  (select auth.uid()) = user_id
  and (select private.is_active_account())
  and (select private.setting_enabled('cloud_favorites_enabled'))
)
with check (
  (select auth.uid()) = user_id
  and (select private.is_active_account())
  and (select private.setting_enabled('cloud_favorites_enabled'))
);

create policy favorites_delete_active_own on public.user_favorites
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and (select private.is_active_account())
  and (select private.setting_enabled('cloud_favorites_enabled'))
);

alter table public.user_favorites
  add constraint user_favorites_snapshot_kind
    check (snapshot is null or kind = 'auction'::public.favorite_kind),
  add constraint user_favorites_snapshot_size
    check (snapshot is null or pg_column_size(snapshot) <= 65536);

create or replace function private.enforce_user_favorite_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if not exists (
      select 1 from public.user_favorites existing
      where existing.user_id = new.user_id
        and existing.kind = new.kind
        and existing.entity_id = new.entity_id
    )
    and (select count(*) from public.user_favorites where user_id = new.user_id) >= 1500 then
    raise exception 'Maximal 1500 Cloud-Favoriten pro Konto' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_user_favorite_quota() from public, anon, authenticated;
create trigger user_favorites_enforce_quota
before insert on public.user_favorites
for each row execute function private.enforce_user_favorite_quota();

create or replace function private.admin_set_user_access(
  p_user_id uuid,
  p_role public.app_role,
  p_status public.account_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_access public.account_access%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Das eigene Adminkonto kann hier nicht verändert werden' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('opsucht_dashboard_active_admins'));
  select * into old_access from public.account_access where user_id = p_user_id for update;
  if not found then
    raise exception 'Konto nicht gefunden' using errcode = 'P0002';
  end if;
  if old_access.deletion_requested_at is not null then
    raise exception 'Für dieses Konto läuft bereits eine Löschanforderung' using errcode = '55000';
  end if;
  if old_access.role = 'admin'::public.app_role
     and old_access.status = 'active'::public.account_status
     and (p_role <> 'admin'::public.app_role or p_status <> 'active'::public.account_status)
     and (select count(*) from public.account_access
          where role = 'admin'::public.app_role and status = 'active'::public.account_status) <= 1 then
    raise exception 'Der letzte aktive Admin kann nicht entfernt oder gesperrt werden' using errcode = '22023';
  end if;

  update public.account_access
  set role = p_role, status = p_status
  where user_id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values ((select auth.uid()), 'account_access_updated', p_user_id, jsonb_build_object(
    'old_role', old_access.role, 'new_role', p_role,
    'old_status', old_access.status, 'new_status', p_status
  ));
end;
$$;

create or replace function private.admin_list_audit(p_limit integer default 100)
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
  select log.id, log.actor_id,
    coalesce(actor.email::text, log.details ->> 'actor_email'),
    log.action, log.target_user_id,
    coalesce(target.email::text, log.details ->> 'target_email'),
    log.details, log.created_at
  from public.admin_audit_log log
  left join auth.users actor on actor.id = log.actor_id
  left join auth.users target on target.id = log.target_user_id
  order by log.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create function private.admin_list_users_v2()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.account_status,
  email_confirmed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  favorites_count bigint,
  market_favorites bigint,
  merchant_favorites bigint,
  auction_favorites bigint,
  deletion_requested_at timestamptz
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
    users.email_confirmed_at is not null, users.created_at, users.last_sign_in_at,
    profiles.last_seen_at, count(favorites.id),
    count(favorites.id) filter (where favorites.kind = 'market'::public.favorite_kind),
    count(favorites.id) filter (where favorites.kind = 'merchant'::public.favorite_kind),
    count(favorites.id) filter (where favorites.kind = 'auction'::public.favorite_kind),
    access.deletion_requested_at
  from auth.users users
  join public.profiles profiles on profiles.id = users.id
  join public.account_access access on access.user_id = users.id
  left join public.user_favorites favorites on favorites.user_id = users.id
  where users.deleted_at is null
  group by users.id, users.email, profiles.display_name, access.role, access.status,
    users.email_confirmed_at, users.created_at, users.last_sign_in_at,
    profiles.last_seen_at, access.deletion_requested_at
  order by users.created_at desc nulls last;
end;
$$;

revoke all on function private.admin_list_users_v2() from public, anon;
grant execute on function private.admin_list_users_v2() to authenticated;

create function public.admin_list_users_v2()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.account_status,
  email_confirmed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  favorites_count bigint,
  market_favorites bigint,
  merchant_favorites bigint,
  auction_favorites bigint,
  deletion_requested_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.admin_list_users_v2(); $$;

revoke all on function public.admin_list_users_v2() from public, anon;
grant execute on function public.admin_list_users_v2() to authenticated;

grant insert on public.admin_audit_log to service_role;
grant update on public.account_access to service_role;
