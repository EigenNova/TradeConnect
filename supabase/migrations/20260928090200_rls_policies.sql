-- ============================================================================
-- TradeConnect — 003 ROW LEVEL SECURITY
-- Every table is deny-by-default; the policies below are the only way in.
-- ============================================================================

alter table public.profiles                enable row level security;
alter table public.categories              enable row level security;
alter table public.tradesperson_profiles   enable row level security;
alter table public.tradesperson_categories enable row level security;
alter table public.jobs                    enable row level security;
alter table public.job_requests            enable row level security;
alter table public.messages                enable row level security;
alter table public.ratings                 enable row level security;
alter table public.verifications           enable row level security;
alter table public.commissions             enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or role = 'tradesperson'                 -- directory + job pages
    or public.shares_context_with(user_id)   -- my customer / my tradesperson
    or public.is_admin()
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid() and role in ('customer', 'tradesperson'));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
-- (the protect_profile_columns trigger blocks self role escalation)

-- ---------------------------------------------------------------------------
-- categories — public reference data
-- ---------------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to anon, authenticated using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- tradesperson_profiles — publicly browsable, self editable
-- ---------------------------------------------------------------------------
drop policy if exists tradesperson_profiles_select on public.tradesperson_profiles;
create policy tradesperson_profiles_select on public.tradesperson_profiles
  for select to anon, authenticated using (true);

drop policy if exists tradesperson_profiles_insert_self on public.tradesperson_profiles;
create policy tradesperson_profiles_insert_self on public.tradesperson_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists tradesperson_profiles_update_self on public.tradesperson_profiles;
create policy tradesperson_profiles_update_self on public.tradesperson_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
-- (protect_tradesperson_columns keeps verified_status / free_jobs_remaining
--  out of reach for non-admins)

-- ---------------------------------------------------------------------------
-- tradesperson_categories
-- ---------------------------------------------------------------------------
drop policy if exists tradesperson_categories_select on public.tradesperson_categories;
create policy tradesperson_categories_select on public.tradesperson_categories
  for select to anon, authenticated using (true);

drop policy if exists tradesperson_categories_write_self on public.tradesperson_categories;
create policy tradesperson_categories_write_self on public.tradesperson_categories
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- jobs
--   * customers: full access to their own jobs
--   * tradespeople: their assigned jobs + the open leads board
-- ---------------------------------------------------------------------------
drop policy if exists jobs_select_own on public.jobs;
create policy jobs_select_own on public.jobs
  for select to authenticated
  using (
    customer_id = auth.uid()
    or assigned_tradesperson_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists jobs_select_open_leads on public.jobs;
create policy jobs_select_open_leads on public.jobs
  for select to authenticated
  using (status = 'open' and public.current_role_name() = 'tradesperson');

drop policy if exists jobs_insert_own on public.jobs;
create policy jobs_insert_own on public.jobs
  for insert to authenticated with check (customer_id = auth.uid());

drop policy if exists jobs_update_own on public.jobs;
create policy jobs_update_own on public.jobs
  for update to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

drop policy if exists jobs_delete_own_open on public.jobs;
create policy jobs_delete_own_open on public.jobs
  for delete to authenticated
  using ((customer_id = auth.uid() and status = 'open') or public.is_admin());

-- ---------------------------------------------------------------------------
-- job_requests — visible to the tradesperson it concerns and the job owner
-- ---------------------------------------------------------------------------
drop policy if exists job_requests_select on public.job_requests;
create policy job_requests_select on public.job_requests
  for select to authenticated
  using (
    tradesperson_id = auth.uid()
    or public.is_job_customer(job_id)
    or public.is_admin()
  );

drop policy if exists job_requests_insert on public.job_requests;
create policy job_requests_insert on public.job_requests
  for insert to authenticated
  with check (
    (
      origin = 'tradesperson_quote'
      and tradesperson_id = auth.uid()
      and public.is_verified_tradesperson()
    )
    or (
      origin = 'customer_invite'
      and public.is_job_customer(job_id)
    )
  );

drop policy if exists job_requests_update on public.job_requests;
create policy job_requests_update on public.job_requests
  for update to authenticated
  using (
    tradesperson_id = auth.uid()
    or public.is_job_customer(job_id)
    or public.is_admin()
  )
  with check (
    tradesperson_id = auth.uid()
    or public.is_job_customer(job_id)
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- messages — only the two participants (and admins) can read a thread
-- ---------------------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or receiver_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_job_participant(job_id));

-- ---------------------------------------------------------------------------
-- ratings — public to read, insertable only by the job's customer
-- (the enforce_rating_rules trigger checks the job is completed)
-- ---------------------------------------------------------------------------
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select to anon, authenticated using (true);

drop policy if exists ratings_insert_customer on public.ratings;
create policy ratings_insert_customer on public.ratings
  for insert to authenticated
  with check (customer_id = auth.uid() and public.is_job_customer(job_id));

drop policy if exists ratings_admin_write on public.ratings;
create policy ratings_admin_write on public.ratings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- verifications — owner submits, only admins review
-- ---------------------------------------------------------------------------
drop policy if exists verifications_select on public.verifications;
create policy verifications_select on public.verifications
  for select to authenticated
  using (tradesperson_id = auth.uid() or public.is_admin());

drop policy if exists verifications_insert_self on public.verifications;
create policy verifications_insert_self on public.verifications
  for insert to authenticated
  with check (
    tradesperson_id = auth.uid()
    and public.current_role_name() = 'tradesperson'
  );

drop policy if exists verifications_admin_update on public.verifications;
create policy verifications_admin_update on public.verifications
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists verifications_admin_delete on public.verifications;
create policy verifications_admin_delete on public.verifications
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- commissions — read-only for the tradesperson, managed by admins/triggers
-- ---------------------------------------------------------------------------
drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions
  for select to authenticated
  using (tradesperson_id = auth.uid() or public.is_admin());

drop policy if exists commissions_admin_write on public.commissions;
create policy commissions_admin_write on public.commissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies on top of these)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.tradesperson_profiles, public.tradesperson_categories,
  public.jobs, public.job_requests, public.messages, public.ratings,
  public.verifications, public.commissions, public.categories
to authenticated;

grant select on
  public.categories, public.tradesperson_profiles, public.tradesperson_categories,
  public.ratings, public.tradespeople_directory
to anon;

grant select on public.tradespeople_directory to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.accept_job_request(uuid) to authenticated;
grant execute on function public.complete_job(uuid)        to authenticated;
grant execute on function public.admin_metrics()           to authenticated;

revoke execute on function public.admin_metrics() from anon;

-- ---------------------------------------------------------------------------
-- Realtime: stream chat messages to the two participants
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
end;
$$;

alter table public.messages replica identity full;
