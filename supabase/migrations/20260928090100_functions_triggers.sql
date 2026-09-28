-- ============================================================================
-- TradeConnect — 002 FUNCTIONS, TRIGGERS & RPCs
-- Business rules live in the database so they cannot be bypassed by a client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can call them safely)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = p_uid and p.role = 'admin'
  );
$$;

-- True when there is no end-user JWT: the service_role key, a direct SQL
-- connection (migrations, seeds, SQL editor) or a trigger running inside one.
-- The guard triggers below use it so trusted back-office code can still write
-- protected columns.
--
-- This cannot be abused from the public API: every write policy on the guarded
-- tables is granted `to authenticated` and compares against auth.uid(), so an
-- anonymous caller is already rejected by RLS before a trigger ever runs.
create or replace function public.is_privileged()
returns boolean
language sql
stable
as $$
  select auth.uid() is null;
$$;

create or replace function public.current_role_name(p_uid uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.user_id = p_uid;
$$;

create or replace function public.is_verified_tradesperson(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tradesperson_profiles t
    where t.user_id = p_uid and t.verified_status = 'verified'
  );
$$;

-- is the user the customer or the assigned tradesperson on this job?
create or replace function public.is_job_participant(p_job_id uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (j.customer_id = p_uid or j.assigned_tradesperson_id = p_uid)
  );
$$;

-- is the user the customer who posted this job?
create or replace function public.is_job_customer(p_job_id uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.customer_id = p_uid
  );
$$;

-- the "other side" of a job conversation, used to validate chat messages
create or replace function public.job_counterparty(p_job_id uuid, p_uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when j.customer_id = p_uid then j.assigned_tradesperson_id
           when j.assigned_tradesperson_id = p_uid then j.customer_id
         end
  from public.jobs j
  where j.id = p_job_id;
$$;

-- do these two users share a job or a job request? (used by profiles RLS)
create or replace function public.shares_context_with(p_other uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jobs j
    where (j.customer_id = p_uid and j.assigned_tradesperson_id = p_other)
       or (j.customer_id = p_other and j.assigned_tradesperson_id = p_uid)
  ) or exists (
    select 1
    from public.job_requests r
    join public.jobs j on j.id = r.job_id
    where (r.tradesperson_id = p_uid   and j.customer_id = p_other)
       or (r.tradesperson_id = p_other and j.customer_id = p_uid)
  );
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile (+ tradesperson profile). Roles are clamped here so
-- nobody can self-register as an admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  if v_role not in ('customer', 'tradesperson') then
    v_role := 'customer';
  end if;

  insert into public.profiles (user_id, role, full_name, phone, city)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'city', ''), 'Lae')
  )
  on conflict (user_id) do nothing;

  if v_role = 'tradesperson' then
    insert into public.tradesperson_profiles (user_id, service_area)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'city', ''), 'Lae'))
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: a user may edit their own profile but never their own role.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    return new; -- change originated from another trusted trigger
  end if;

  if new.role is distinct from old.role
     and not public.is_admin()
     and not public.is_privileged() then
    raise exception 'Only an admin can change a user role';
  end if;

  new.user_id    := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Guard: tradespeople cannot verify themselves or top up their free jobs.
-- ---------------------------------------------------------------------------
create or replace function public.protect_tradesperson_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    return new; -- verification / commission triggers
  end if;

  if not public.is_admin() and not public.is_privileged() then
    new.verified_status     := old.verified_status;
    new.free_jobs_remaining := old.free_jobs_remaining;
    new.jobs_completed      := old.jobs_completed;
    new.rating_avg          := old.rating_avg;
    new.rating_count        := old.rating_count;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_tradesperson_columns on public.tradesperson_profiles;
create trigger protect_tradesperson_columns
  before update on public.tradesperson_profiles
  for each row execute function public.protect_tradesperson_columns();

-- ---------------------------------------------------------------------------
-- Job status machine
-- ---------------------------------------------------------------------------
create or replace function public.enforce_job_transitions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.customer_id := old.customer_id; -- ownership is immutable

  if old.status = 'completed' and new.status is distinct from 'completed' then
    raise exception 'A completed job cannot be reopened';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.assigned_tradesperson_id is null then
      raise exception 'Assign a tradesperson before completing the job';
    end if;
    new.completed_at := now();
  end if;

  if new.status = 'assigned' and new.assigned_tradesperson_id is null then
    raise exception 'An assigned job needs a tradesperson';
  end if;

  if new.status = 'open' and old.status = 'assigned' then
    new.assigned_tradesperson_id := null; -- customer released the job
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_job_transitions on public.jobs;
create trigger enforce_job_transitions
  before update on public.jobs
  for each row execute function public.enforce_job_transitions();

-- ---------------------------------------------------------------------------
-- MONETISATION: commission on completion
--   * 5% of estimated_value
--   * first 3 completed jobs per tradesperson are commission free
-- ---------------------------------------------------------------------------
create or replace function public.handle_job_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate       numeric(5, 4) := 0.05;
  v_free       int;
  v_amount     numeric(12, 2) := 0;
  v_waived     boolean := false;
  v_commission uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if new.assigned_tradesperson_id is null then
    raise exception 'Assign a tradesperson before completing the job';
  end if;

  -- lock the tradesperson row so two concurrent completions cannot both
  -- consume the same free job
  select t.free_jobs_remaining
    into v_free
  from public.tradesperson_profiles t
  where t.user_id = new.assigned_tradesperson_id
  for update;

  v_free := coalesce(v_free, 0);

  if v_free > 0 then
    v_waived := true;
    v_amount := 0;
  else
    v_waived := false;
    v_amount := round(coalesce(new.estimated_value, 0) * v_rate, 2);
  end if;

  insert into public.commissions
    (job_id, tradesperson_id, job_value, rate, amount, waived, status)
  values
    (new.id,
     new.assigned_tradesperson_id,
     coalesce(new.estimated_value, 0),
     v_rate,
     v_amount,
     v_waived,
     case when v_waived then 'waived' else 'pending' end)
  on conflict (job_id) do nothing
  returning id into v_commission;

  if v_commission is null then
    return new; -- commission already recorded for this job
  end if;

  update public.tradesperson_profiles t
     set jobs_completed      = t.jobs_completed + 1,
         free_jobs_remaining = greatest(t.free_jobs_remaining - (case when v_waived then 1 else 0 end), 0)
   where t.user_id = new.assigned_tradesperson_id;

  return new;
end;
$$;

drop trigger if exists on_job_completed on public.jobs;
create trigger on_job_completed
  after update of status on public.jobs
  for each row execute function public.handle_job_completion();

-- ---------------------------------------------------------------------------
-- Ratings: only the job customer, only after completion. The trigger rewrites
-- the identity columns from the job so they cannot be spoofed.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_rating_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.status <> 'completed' then
    raise exception 'You can only review a completed job';
  end if;

  if v_job.assigned_tradesperson_id is null then
    raise exception 'This job has no tradesperson to review';
  end if;

  new.customer_id     := v_job.customer_id;
  new.tradesperson_id := v_job.assigned_tradesperson_id;
  return new;
end;
$$;

drop trigger if exists enforce_rating_rules on public.ratings;
create trigger enforce_rating_rules
  before insert on public.ratings
  for each row execute function public.enforce_rating_rules();

create or replace function public.sync_tradesperson_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tp uuid := coalesce(new.tradesperson_id, old.tradesperson_id);
begin
  update public.tradesperson_profiles t
     set rating_avg   = coalesce((select round(avg(r.stars)::numeric, 2) from public.ratings r where r.tradesperson_id = v_tp), 0),
         rating_count = (select count(*) from public.ratings r where r.tradesperson_id = v_tp)
   where t.user_id = v_tp;
  return null;
end;
$$;

drop trigger if exists sync_tradesperson_rating on public.ratings;
create trigger sync_tradesperson_rating
  after insert or update or delete on public.ratings
  for each row execute function public.sync_tradesperson_rating();

-- ---------------------------------------------------------------------------
-- Verification workflow
-- ---------------------------------------------------------------------------
create or replace function public.handle_verification_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.status      := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;

drop trigger if exists on_verification_submitted on public.verifications;
create trigger on_verification_submitted
  before insert on public.verifications
  for each row execute function public.handle_verification_submitted();

create or replace function public.sync_verification_pending()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.tradesperson_profiles t
     set verified_status = 'pending'
   where t.user_id = new.tradesperson_id
     and t.verified_status <> 'verified';
  return null;
end;
$$;

drop trigger if exists after_verification_submitted on public.verifications;
create trigger after_verification_submitted
  after insert on public.verifications
  for each row execute function public.sync_verification_pending();

-- admin decision -> stamp reviewer + mirror the status onto the profile
create or replace function public.handle_verification_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not public.is_admin() and not public.is_privileged() then
    raise exception 'Only an admin can review verifications';
  end if;

  new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  new.reviewed_at := now();
  return new;
end;
$$;

drop trigger if exists on_verification_reviewed on public.verifications;
create trigger on_verification_reviewed
  before update on public.verifications
  for each row execute function public.handle_verification_review();

create or replace function public.apply_verification_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return null;
  end if;

  update public.tradesperson_profiles t
     set verified_status = case new.status
                             when 'approved' then 'verified'
                             when 'rejected' then 'rejected'
                             else 'pending'
                           end
   where t.user_id = new.tradesperson_id;

  return null;
end;
$$;

drop trigger if exists after_verification_reviewed on public.verifications;
create trigger after_verification_reviewed
  after update on public.verifications
  for each row execute function public.apply_verification_review();

-- ---------------------------------------------------------------------------
-- Job request guards
-- ---------------------------------------------------------------------------
create or replace function public.enforce_job_request_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  if tg_op = 'INSERT' then
    if v_job.status <> 'open' then
      raise exception 'This job is no longer open';
    end if;
    if v_job.customer_id = new.tradesperson_id then
      raise exception 'You cannot quote on your own job';
    end if;
    new.status := 'pending';
    return new;
  end if;

  -- UPDATE
  new.job_id          := old.job_id;
  new.tradesperson_id := old.tradesperson_id;
  new.origin          := old.origin;
  new.created_at      := old.created_at;

  if new.status = 'accepted'
     and v_job.assigned_tradesperson_id is distinct from new.tradesperson_id then
    raise exception 'Use accept_job_request() to accept a request';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_job_request_rules on public.job_requests;
create trigger enforce_job_request_rules
  before insert or update on public.job_requests
  for each row execute function public.enforce_job_request_rules();

-- ---------------------------------------------------------------------------
-- RPC: accept a request (tradesperson accepts an invite, or customer accepts
-- a quote). Assigns the job and declines every other pending request.
-- ---------------------------------------------------------------------------
create or replace function public.accept_job_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.job_requests%rowtype;
  v_job public.jobs%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_req from public.job_requests r where r.id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;

  select * into v_job from public.jobs j where j.id = v_req.job_id for update;
  if v_job.status <> 'open' then
    raise exception 'This job is no longer open';
  end if;

  -- who is allowed to accept?
  if v_req.origin = 'customer_invite' then
    if v_uid <> v_req.tradesperson_id then
      raise exception 'Only the invited tradesperson can accept this request';
    end if;
  else
    if v_uid <> v_job.customer_id and not public.is_admin() then
      raise exception 'Only the customer can accept a quote';
    end if;
  end if;

  if not public.is_verified_tradesperson(v_req.tradesperson_id) then
    raise exception 'This tradesperson is not verified yet';
  end if;

  update public.jobs
     set assigned_tradesperson_id = v_req.tradesperson_id,
         status = 'assigned',
         estimated_value = case
                             when v_req.quoted_price is not null then v_req.quoted_price
                             else estimated_value
                           end
   where id = v_job.id;

  update public.job_requests
     set status = 'accepted'
   where id = v_req.id;

  update public.job_requests
     set status = 'declined'
   where job_id = v_job.id
     and id <> v_req.id
     and status = 'pending';

  return v_job.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mark a job complete (customer or the assigned tradesperson).
-- The commission trigger fires from here.
-- ---------------------------------------------------------------------------
create or replace function public.complete_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into v_job from public.jobs j where j.id = p_job_id for update;

  if not found then
    raise exception 'Job not found';
  end if;

  if v_uid is distinct from v_job.customer_id
     and v_uid is distinct from v_job.assigned_tradesperson_id
     and not public.is_admin() then
    raise exception 'Only the job participants can complete this job';
  end if;

  if v_job.status = 'completed' then
    return v_job.id;
  end if;

  if v_job.status <> 'assigned' then
    raise exception 'Only an assigned job can be completed';
  end if;

  update public.jobs set status = 'completed' where id = v_job.id;
  return v_job.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages: enforce that the pair is (sender, counterparty) of the job.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  if new.sender_id not in (v_job.customer_id, coalesce(v_job.assigned_tradesperson_id, new.sender_id))
     or (v_job.assigned_tradesperson_id is null and new.sender_id <> v_job.customer_id) then
    raise exception 'Only job participants can send messages';
  end if;

  if v_job.assigned_tradesperson_id is null then
    raise exception 'Chat opens once a tradesperson is assigned';
  end if;

  new.receiver_id := case
                       when new.sender_id = v_job.customer_id then v_job.assigned_tradesperson_id
                       else v_job.customer_id
                     end;
  return new;
end;
$$;

drop trigger if exists enforce_message_rules on public.messages;
create trigger enforce_message_rules
  before insert on public.messages
  for each row execute function public.enforce_message_rules();

-- ---------------------------------------------------------------------------
-- Admin metrics (single round trip for /admin/metrics)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v json;
begin
  if not public.is_admin() and not public.is_privileged() then
    raise exception 'Admins only';
  end if;

  select json_build_object(
    'total_users',            (select count(*) from public.profiles),
    'total_customers',        (select count(*) from public.profiles where role = 'customer'),
    'total_tradespeople',     (select count(*) from public.profiles where role = 'tradesperson'),
    'verified_tradespeople',  (select count(*) from public.tradesperson_profiles where verified_status = 'verified'),
    'pending_verifications',  (select count(*) from public.verifications where status = 'pending'),
    'total_jobs',             (select count(*) from public.jobs),
    'open_jobs',              (select count(*) from public.jobs where status = 'open'),
    'assigned_jobs',          (select count(*) from public.jobs where status = 'assigned'),
    'completed_jobs',         (select count(*) from public.jobs where status = 'completed'),
    'gross_job_value',        (select coalesce(sum(estimated_value), 0) from public.jobs where status = 'completed'),
    'commission_billed',      (select coalesce(sum(amount), 0) from public.commissions where not waived),
    'commission_waived_count',(select count(*) from public.commissions where waived)
  ) into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public directory view (no phone numbers / no PII)
-- ---------------------------------------------------------------------------
create or replace view public.tradespeople_directory as
  select
    p.user_id,
    p.full_name,
    p.city,
    t.bio,
    t.service_area,
    t.years_experience,
    t.hourly_rate,
    t.verified_status,
    t.jobs_completed,
    t.rating_avg,
    t.rating_count,
    coalesce(
      (select array_agg(c.name order by c.name)
         from public.tradesperson_categories tc
         join public.categories c on c.id = tc.category_id
        where tc.user_id = p.user_id),
      '{}'::text[]
    ) as categories,
    coalesce(
      (select array_agg(c.id order by c.id)
         from public.tradesperson_categories tc
         join public.categories c on c.id = tc.category_id
        where tc.user_id = p.user_id),
      '{}'::int[]
    ) as category_ids
  from public.profiles p
  join public.tradesperson_profiles t on t.user_id = p.user_id
  where p.role = 'tradesperson';

comment on view public.tradespeople_directory is
  'Anonymous-readable directory projection: safe columns only (no phone/email).';
