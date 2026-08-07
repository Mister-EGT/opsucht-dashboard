create or replace function private.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Adminberechtigung erforderlich' using errcode = '42501';
  end if;

  with live_users as (
    select users.id, users.created_at, users.email_confirmed_at, users.last_sign_in_at
    from auth.users users
    where users.deleted_at is null
  ), live_accounts as (
    select access.user_id, access.role, access.status, access.deletion_requested_at
    from public.account_access access
    join live_users users on users.id = access.user_id
  ), account_activity as (
    select users.id, greatest(profiles.last_seen_at, users.last_sign_in_at) as active_at
    from live_users users
    join public.profiles profiles on profiles.id = users.id
  ), favorite_counts as (
    select favorites.user_id, count(*)::bigint as favorite_count
    from public.user_favorites favorites
    join live_users users on users.id = favorites.user_id
    group by favorites.user_id
  ), days as (
    select generate_series(current_date - 13, current_date, interval '1 day')::date as day
  )
  select jsonb_build_object(
    'accounts_total', (select count(*) from live_users),
    'accounts_confirmed', (select count(*) from live_users where email_confirmed_at is not null),
    'accounts_unconfirmed', (select count(*) from live_users where email_confirmed_at is null),
    'accounts_active', (select count(*) from live_accounts where status = 'active'::public.account_status),
    'accounts_suspended', (select count(*) from live_accounts where status = 'suspended'::public.account_status),
    'admins', (select count(*) from live_accounts where role = 'admin'::public.app_role),
    'active_admins', (select count(*) from live_accounts where role = 'admin'::public.app_role and status = 'active'::public.account_status),
    'never_signed_in', (select count(*) from live_users where last_sign_in_at is null),
    'deletion_requests', (select count(*) from live_accounts where deletion_requested_at is not null),
    'signups_24h', (select count(*) from live_users where created_at >= now() - interval '24 hours'),
    'signups_7d', (select count(*) from live_users where created_at >= now() - interval '7 days'),
    'signups_30d', (select count(*) from live_users where created_at >= now() - interval '30 days'),
    'active_24h', (select count(*) from account_activity where active_at >= now() - interval '24 hours'),
    'active_7d', (select count(*) from account_activity where active_at >= now() - interval '7 days'),
    'active_30d', (select count(*) from account_activity where active_at >= now() - interval '30 days'),
    'favorites_total', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id),
    'market_favorites', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id where favorites.kind = 'market'::public.favorite_kind),
    'merchant_favorites', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id where favorites.kind = 'merchant'::public.favorite_kind),
    'auction_favorites', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id where favorites.kind = 'auction'::public.favorite_kind),
    'favorites_changed_24h', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id where favorites.updated_at >= now() - interval '24 hours'),
    'favorites_changed_7d', (select count(*) from public.user_favorites favorites join live_users users on users.id = favorites.user_id where favorites.updated_at >= now() - interval '7 days'),
    'accounts_with_favorites', (select count(*) from favorite_counts where favorite_count > 0),
    'average_favorites_per_account', coalesce((select round(avg(favorite_count)::numeric, 1)::double precision from favorite_counts), 0),
    'max_favorites_per_account', coalesce((select max(favorite_count) from favorite_counts), 0),
    'active_sessions', (
      select count(*) from auth.sessions sessions
      join live_users users on users.id = sessions.user_id
      where sessions.not_after is null or sessions.not_after > now()
    ),
    'accounts_with_sessions', (
      select count(distinct sessions.user_id) from auth.sessions sessions
      join live_users users on users.id = sessions.user_id
      where sessions.not_after is null or sessions.not_after > now()
    ),
    'audit_events_24h', (select count(*) from public.admin_audit_log where created_at >= now() - interval '24 hours'),
    'audit_events_7d', (select count(*) from public.admin_audit_log where created_at >= now() - interval '7 days'),
    'daily_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(days.day, 'YYYY-MM-DD'),
        'registrations', (select count(*) from live_users where created_at >= days.day and created_at < days.day + 1),
        'active_accounts', (select count(*) from account_activity where active_at >= days.day and active_at < days.day + 1),
        'favorites_saved', (
          select count(*) from public.user_favorites favorites
          join live_users users on users.id = favorites.user_id
          where favorites.saved_at >= days.day and favorites.saved_at < days.day + 1
        )
      ) order by days.day), '[]'::jsonb)
      from days
    )
  ) into result;

  return result;
end;
$$;

create function private.admin_list_users_v3()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.account_status,
  email_confirmed boolean,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  auth_updated_at timestamptz,
  profile_updated_at timestamptz,
  access_updated_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  favorites_count bigint,
  market_favorites bigint,
  merchant_favorites bigint,
  auction_favorites bigint,
  last_favorite_at timestamptz,
  favorite_snapshot_bytes bigint,
  active_sessions bigint,
  last_session_at timestamptz,
  auth_providers text[],
  auth_banned_until timestamptz,
  is_anonymous boolean,
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
  with favorite_totals as (
    select favorites.user_id,
      count(*) as favorites_count,
      count(*) filter (where favorites.kind = 'market'::public.favorite_kind)::bigint as market_favorites,
      count(*) filter (where favorites.kind = 'merchant'::public.favorite_kind)::bigint as merchant_favorites,
      count(*) filter (where favorites.kind = 'auction'::public.favorite_kind)::bigint as auction_favorites,
      max(favorites.updated_at) as last_favorite_at,
      coalesce(sum(coalesce(pg_column_size(favorites.snapshot), 0)), 0)::bigint as favorite_snapshot_bytes
    from public.user_favorites favorites
    group by favorites.user_id
  ), session_totals as (
    select sessions.user_id,
      count(*) filter (where sessions.not_after is null or sessions.not_after > now())::bigint as active_sessions,
      max(sessions.created_at) filter (where sessions.not_after is null or sessions.not_after > now()) as last_session_at
    from auth.sessions sessions
    group by sessions.user_id
  ), identity_totals as (
    select identities.user_id, array_agg(distinct identities.provider order by identities.provider)::text[] as auth_providers
    from auth.identities identities
    group by identities.user_id
  )
  select users.id, users.email::text, profiles.display_name, access.role, access.status,
    users.email_confirmed_at is not null, users.email_confirmed_at, users.created_at,
    users.updated_at, profiles.updated_at, access.updated_at, users.last_sign_in_at,
    profiles.last_seen_at, coalesce(favorites.favorites_count, 0),
    coalesce(favorites.market_favorites, 0), coalesce(favorites.merchant_favorites, 0),
    coalesce(favorites.auction_favorites, 0), favorites.last_favorite_at,
    coalesce(favorites.favorite_snapshot_bytes, 0), coalesce(sessions.active_sessions, 0),
    sessions.last_session_at, coalesce(identities.auth_providers, array[]::text[]),
    users.banned_until, coalesce(users.is_anonymous, false), access.deletion_requested_at
  from auth.users users
  join public.profiles profiles on profiles.id = users.id
  join public.account_access access on access.user_id = users.id
  left join favorite_totals favorites on favorites.user_id = users.id
  left join session_totals sessions on sessions.user_id = users.id
  left join identity_totals identities on identities.user_id = users.id
  where users.deleted_at is null
  order by users.created_at desc nulls last;
end;
$$;

revoke all on function private.admin_list_users_v3() from public, anon;
grant execute on function private.admin_list_users_v3() to authenticated;

create function public.admin_list_users_v3()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.account_status,
  email_confirmed boolean,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  auth_updated_at timestamptz,
  profile_updated_at timestamptz,
  access_updated_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  favorites_count bigint,
  market_favorites bigint,
  merchant_favorites bigint,
  auction_favorites bigint,
  last_favorite_at timestamptz,
  favorite_snapshot_bytes bigint,
  active_sessions bigint,
  last_session_at timestamptz,
  auth_providers text[],
  auth_banned_until timestamptz,
  is_anonymous boolean,
  deletion_requested_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.admin_list_users_v3(); $$;

revoke all on function public.admin_list_users_v3() from public, anon;
grant execute on function public.admin_list_users_v3() to authenticated;
