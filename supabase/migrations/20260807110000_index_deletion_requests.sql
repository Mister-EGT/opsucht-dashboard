create index account_access_deletion_requested_by_idx
  on public.account_access (deletion_requested_by)
  where deletion_requested_by is not null;
