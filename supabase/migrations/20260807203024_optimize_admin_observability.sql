create index user_favorites_saved_at_idx on public.user_favorites (saved_at desc);
create index user_favorites_updated_at_idx on public.user_favorites (updated_at desc);

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
  ), user_stats as (
    select count(*) as accounts_total,
      count(*) filter (where email_confirmed_at is not null) as accounts_confirmed,
      count(*) filter (where email_confirmed_at is null) as accounts_unconfirmed,
      count(*) filter (where last_sign_in_at is null) as never_signed_in,
      count(*) filter (where created_at >= now() - interval '24 hours') as signups_24h,
      count(*) filter (where created_at >= now() - interval '7 days') as signups_7d,
      count(*) filter (where created_at >= now() - interval '30 days') as signups_30d
    from live_users
  ), live_accounts as (
    select access.user_id, access.role, access.status, access.deletion_requested_at
    from public.account_access access
    join live_users users on users.id = access.user_id
  ), account_stats as (
    select count(*) filter (where status = 'active'::public.account_status) as accounts_active,
      count(*) filter (where status = 'suspended'::public.account_status) as accounts_suspended,
      count(*) filter (where role = 'admin'::public.app_role) as admins,
      count(*) filter (where role = 'admin'::public.app_role and status = 'active'::public.account_status) as active_admins,
      count(*) filter (where deletion_requested_at is not null) as deletion_requests
    from live_accounts
  ), account_activity as (
    select users.id, greatest(profiles.last_seen_at, users.last_sign_in_at) as active_at
    from live_users users
    join public.profiles profiles on profiles.id = users.id
  ), activity_stats as (
    select count(*) filter (where active_at >= now() - interval '24 hours') as active_24h,
      count(*) filter (where active_at >= now() - interval '7 days') as active_7d,
      count(*) filter (where active_at >= now() - interval '30 days') as active_30d
    from account_activity
  ), favorite_counts as (
    select favorites.user_id, count(*) as favorite_count
    from public.user_favorites favorites
    join live_users users on users.id = favorites.user_id
    group by favorites.user_id
  ), favorite_stats as (
    select count(*) as favorites_total,
      count(*) filter (where favorites.kind = 'market'::public.favorite_kind) as market_favorites,
      count(*) filter (where favorites.kind = 'merchant'::public.favorite_kind) as merchant_favorites,
      count(*) filter (where favorites.kind = 'auction'::public.favorite_kind) as auction_favorites,
      count(*) filter (where favorites.updated_at >= now() - interval '24 hours') as favorites_changed_24h,
      count(*) filter (where favorites.updated_at >= now() - interval '7 days') as favorites_changed_7d
    from public.user_favorites favorites
    join live_users users on users.id = favorites.user_id
  ), favorite_account_stats as (
    select count(*) as accounts_with_favorites, coalesce(max(favorite_count), 0) as max_favorites_per_account
    from favorite_counts
  ), session_stats as (
    select count(*) as active_sessions, count(distinct sessions.user_id) as accounts_with_sessions
    from auth.sessions sessions
    join live_users users on users.id = sessions.user_id
    where sessions.not_after is null or sessions.not_after > now()
  ), audit_stats as (
    select count(*) filter (where created_at >= now() - interval '24 hours') as audit_events_24h,
      count(*) filter (where created_at >= now() - interval '7 days') as audit_events_7d
    from public.admin_audit_log
  ), days as (
    select generate_series(current_date - 13, current_date, interval '1 day')::date as day
  ), daily_registrations as (
    select created_at::date as day, count(*) as registrations
    from live_users
    where created_at >= current_date - 13
    group by created_at::date
  ), daily_activity as (
    select active_at::date as day, count(*) as active_accounts
    from account_activity
    where active_at >= current_date - 13
    group by active_at::date
  ), daily_favorites as (
    select favorites.saved_at::date as day, count(*) as favorites_saved
    from public.user_favorites favorites
    join live_users users on users.id = favorites.user_id
    where favorites.saved_at >= current_date - 13
    group by favorites.saved_at::date
  ), daily_history as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'registrations', coalesce(registrations.registrations, 0),
      'active_accounts', coalesce(activity.active_accounts, 0),
      'favorites_saved', coalesce(favorites.favorites_saved, 0)
    ) order by days.day) as entries
    from days
    left join daily_registrations registrations on registrations.day = days.day
    left join daily_activity activity on activity.day = days.day
    left join daily_favorites favorites on favorites.day = days.day
  )
  select jsonb_build_object(
    'accounts_total', users.accounts_total,
    'accounts_confirmed', users.accounts_confirmed,
    'accounts_unconfirmed', users.accounts_unconfirmed,
    'accounts_active', accounts.accounts_active,
    'accounts_suspended', accounts.accounts_suspended,
    'admins', accounts.admins,
    'active_admins', accounts.active_admins,
    'never_signed_in', users.never_signed_in,
    'deletion_requests', accounts.deletion_requests,
    'signups_24h', users.signups_24h,
    'signups_7d', users.signups_7d,
    'signups_30d', users.signups_30d,
    'active_24h', activity.active_24h,
    'active_7d', activity.active_7d,
    'active_30d', activity.active_30d,
    'favorites_total', favorites.favorites_total,
    'market_favorites', favorites.market_favorites,
    'merchant_favorites', favorites.merchant_favorites,
    'auction_favorites', favorites.auction_favorites,
    'favorites_changed_24h', favorites.favorites_changed_24h,
    'favorites_changed_7d', favorites.favorites_changed_7d,
    'accounts_with_favorites', favorite_accounts.accounts_with_favorites,
    'average_favorites_per_account', coalesce(round((favorites.favorites_total::numeric / nullif(users.accounts_total, 0)), 1)::double precision, 0),
    'max_favorites_per_account', favorite_accounts.max_favorites_per_account,
    'active_sessions', sessions.active_sessions,
    'accounts_with_sessions', sessions.accounts_with_sessions,
    'audit_events_24h', audit.audit_events_24h,
    'audit_events_7d', audit.audit_events_7d,
    'daily_history', coalesce(history.entries, '[]'::jsonb)
  ) into result
  from user_stats users
  cross join account_stats accounts
  cross join activity_stats activity
  cross join favorite_stats favorites
  cross join favorite_account_stats favorite_accounts
  cross join session_stats sessions
  cross join audit_stats audit
  cross join daily_history history;

  return result;
end;
$$;
