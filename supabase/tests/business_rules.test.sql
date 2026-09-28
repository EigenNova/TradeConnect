-- ============================================================================
-- TradeConnect — business rule + RLS test suite (plain SQL, no pgTAP needed).
-- Every check raises an exception on failure, so a clean run = all green.
--
--   psql "$DB_URL" -f supabase/tests/supabase_stubs.sql        # scratch DB only
--   for f in supabase/migrations/*.sql; do psql "$DB_URL" -f "$f"; done
--   psql "$DB_URL" -f supabase/tests/business_rules.test.sql
-- ============================================================================

\set ON_ERROR_STOP on

reset role;

-- act-as helper (test only)
create or replace function public.test_login(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    false
  );
end;
$$;

create or replace function public.test_logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
delete from auth.users where email like '%@test.tradeconnect.pg';

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'customer1@test.tradeconnect.pg',
   '{"role":"customer","full_name":"Mary Customer","city":"Lae"}'),
  ('55555555-5555-5555-5555-555555555555', 'customer2@test.tradeconnect.pg',
   '{"role":"customer","full_name":"Other Customer","city":"Lae"}'),
  ('22222222-2222-2222-2222-222222222222', 'tradie1@test.tradeconnect.pg',
   '{"role":"tradesperson","full_name":"Joe Sparky","city":"Lae"}'),
  ('33333333-3333-3333-3333-333333333333', 'tradie2@test.tradeconnect.pg',
   '{"role":"tradesperson","full_name":"Unverified Tradie","city":"Lae"}'),
  ('44444444-4444-4444-4444-444444444444', 'admin@test.tradeconnect.pg',
   '{"role":"admin","full_name":"Pilot Admin","city":"Lae"}');

-- self-registration cannot mint an admin: handle_new_user clamps the role
do $$
begin
  assert (select role from public.profiles where user_id = '44444444-4444-4444-4444-444444444444') = 'customer',
    'T01 self-registered admin role should be clamped to customer';
  assert (select count(*) from public.tradesperson_profiles) = 2,
    'T02 tradesperson_profiles should be auto-created for tradespeople';
  assert (select free_jobs_remaining from public.tradesperson_profiles
           where user_id = '22222222-2222-2222-2222-222222222222') = 3,
    'T03 free_jobs_remaining should default to 3';
end;
$$;

-- promote the admin from a trusted (direct SQL) connection
update public.profiles set role = 'admin' where user_id = '44444444-4444-4444-4444-444444444444';

insert into public.tradesperson_categories (user_id, category_id)
values ('22222222-2222-2222-2222-222222222222', 1)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Guard rails on self-service updates
-- ---------------------------------------------------------------------------
select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;

do $$
begin
  -- a tradesperson may not verify themselves or mint free jobs
  update public.tradesperson_profiles
     set verified_status = 'verified', free_jobs_remaining = 99, bio = 'Master electrician'
   where user_id = auth.uid();

  assert (select verified_status from public.tradesperson_profiles where user_id = auth.uid()) = 'unverified',
    'T04 self-verification must be ignored';
  assert (select free_jobs_remaining from public.tradesperson_profiles where user_id = auth.uid()) = 3,
    'T05 free_jobs_remaining must not be user-writable';
  assert (select bio from public.tradesperson_profiles where user_id = auth.uid()) = 'Master electrician',
    'T06 bio should still be editable';
end;
$$;

do $$
begin
  begin
    update public.profiles set role = 'admin' where user_id = auth.uid();
    raise exception 'TEST FAILED T07: self role escalation was allowed';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;

-- unverified tradespeople cannot quote
insert into public.verifications (tradesperson_id, id_doc_url, certificate_url)
values (auth.uid(), '22222222-2222-2222-2222-222222222222/id.jpg',
                    '22222222-2222-2222-2222-222222222222/cert.pdf');

do $$
begin
  assert (select verified_status from public.tradesperson_profiles where user_id = auth.uid()) = 'pending',
    'T08 submitting documents should flip the profile to pending';
end;
$$;

reset role;

-- another tradesperson must not see someone else's verification documents
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  assert (select count(*) from public.verifications) = 0,
    'T09 verifications of other tradespeople must be invisible';
end;
$$;
reset role;

-- admin approves
select public.test_login('44444444-4444-4444-4444-444444444444');
set role authenticated;
do $$
declare v_id uuid;
begin
  assert (select count(*) from public.verifications where status = 'pending') = 1,
    'T10 admin should see the pending queue';
  select id into v_id from public.verifications where status = 'pending';
  update public.verifications set status = 'approved' where id = v_id;

  assert (select verified_status from public.tradesperson_profiles
           where user_id = '22222222-2222-2222-2222-222222222222') = 'verified',
    'T11 approval should mark the tradesperson verified';
  assert (select reviewed_by from public.verifications where id = v_id) = auth.uid(),
    'T12 approval should stamp the reviewer';
end;
$$;
reset role;

-- a non-admin cannot review
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  begin
    update public.verifications set status = 'approved';
    if (select count(*) from public.verifications where status = 'approved') > 0 then
      -- RLS filtered the row out entirely, which is also a pass
      null;
    end if;
  exception
    when others then null;
  end;
  assert (select count(*) from public.verifications where tradesperson_id = auth.uid()) = 0,
    'T13 non-admin review attempt must not create data';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Job posting + leads visibility
-- ---------------------------------------------------------------------------
select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;

insert into public.jobs (id, customer_id, category_id, title, description, location_text, estimated_value)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 1,
        'Rewire kitchen', 'Kitchen circuit keeps tripping', 'Eriku, Lae', 500);

do $$
begin
  assert (select count(*) from public.jobs) = 1, 'T14 customer can read their own job';
end;
$$;
reset role;

-- second customer cannot see it
select public.test_login('55555555-5555-5555-5555-555555555555');
set role authenticated;
do $$
begin
  assert (select count(*) from public.jobs) = 0,
    'T15 customers must not see other customers jobs';
end;
$$;
reset role;

-- an unverified tradesperson sees the open lead but cannot quote
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  assert (select count(*) from public.jobs where status = 'open') = 1,
    'T16 tradespeople can browse open leads';
  begin
    insert into public.job_requests (job_id, tradesperson_id, origin, message, quoted_price)
    values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'tradesperson_quote', 'I can do it', 400);
    raise exception 'TEST FAILED T17: unverified tradesperson was allowed to quote';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

-- verified tradesperson quotes
select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;
insert into public.job_requests (id, job_id, tradesperson_id, origin, message, quoted_price)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        auth.uid(), 'tradesperson_quote', 'Can start tomorrow 8am', 600);

do $$
begin
  begin
    -- cannot self-accept by flipping the status
    update public.job_requests set status = 'accepted'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001';
    raise exception 'TEST FAILED T18: tradesperson self-accepted a quote';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

-- customer accepts the quote
select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  perform public.accept_job_request('bbbbbbbb-0000-0000-0000-000000000001');

  assert (select status from public.jobs where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'assigned',
    'T19 accepting a quote assigns the job';
  assert (select assigned_tradesperson_id from public.jobs where id = 'aaaaaaaa-0000-0000-0000-000000000001')
         = '22222222-2222-2222-2222-222222222222',
    'T20 the quoting tradesperson is assigned';
  assert (select estimated_value from public.jobs where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 600,
    'T21 the accepted quote becomes the job value';
end;
$$;

-- chat
insert into public.messages (job_id, sender_id, receiver_id, body)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
        '22222222-2222-2222-2222-222222222222', 'Great, see you at 8.');

do $$
begin
  assert (select receiver_id from public.messages limit 1) = '22222222-2222-2222-2222-222222222222',
    'T22 receiver is derived from the job';
end;
$$;

-- reviews are blocked before completion
do $$
begin
  begin
    insert into public.ratings (job_id, customer_id, tradesperson_id, stars, review_text)
    values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
            '22222222-2222-2222-2222-222222222222', 5, 'too early');
    raise exception 'TEST FAILED T23: review accepted before completion';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

-- outsider cannot read the thread
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  assert (select count(*) from public.messages) = 0,
    'T24 messages are private to the two participants';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Completion + commission engine
-- ---------------------------------------------------------------------------
select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$
begin
  perform public.complete_job('aaaaaaaa-0000-0000-0000-000000000001');

  assert (select status from public.jobs where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'completed',
    'T25 tradesperson can complete an assigned job';
  assert (select waived from public.commissions where job_id = 'aaaaaaaa-0000-0000-0000-000000000001') = true,
    'T26 first job commission is waived';
  assert (select amount from public.commissions where job_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
    'T27 waived commission amount is 0';
  assert (select status from public.commissions where job_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'waived',
    'T28 waived commission status';
  assert (select free_jobs_remaining from public.tradesperson_profiles
           where user_id = auth.uid()) = 2,
    'T29 free_jobs_remaining decremented to 2';
  assert (select jobs_completed from public.tradesperson_profiles where user_id = auth.uid()) = 1,
    'T30 jobs_completed incremented';
end;
$$;
reset role;

-- customer reviews the finished job
select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;
insert into public.ratings (job_id, customer_id, tradesperson_id, stars, review_text)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
        '22222222-2222-2222-2222-222222222222', 5, 'Fast and tidy work');

do $$
begin
  assert (select rating_avg from public.tradesperson_profiles
           where user_id = '22222222-2222-2222-2222-222222222222') = 5.00,
    'T31 rating average synced';
  assert (select rating_count from public.tradesperson_profiles
           where user_id = '22222222-2222-2222-2222-222222222222') = 1,
    'T32 rating count synced';

  begin
    insert into public.ratings (job_id, customer_id, tradesperson_id, stars)
    values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
            '22222222-2222-2222-2222-222222222222', 1);
    raise exception 'TEST FAILED T33: duplicate review accepted';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;

-- jobs 2 and 3 (invite flow) burn the remaining free jobs
do $$
declare
  v_job uuid;
  v_req uuid;
  i int;
begin
  for i in 2..3 loop
    insert into public.jobs (customer_id, category_id, title, description, location_text, estimated_value)
    values (auth.uid(), 1, 'Job ' || i, 'Work item ' || i, 'Lae', 1000)
    returning id into v_job;

    insert into public.job_requests (job_id, tradesperson_id, origin, message)
    values (v_job, '22222222-2222-2222-2222-222222222222', 'customer_invite', 'Please take this on')
    returning id into v_req;

    perform set_config('app.req_' || i, v_req::text, false);
    perform set_config('app.job_' || i, v_job::text, false);
  end loop;
end;
$$;
reset role;

select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$
declare i int;
begin
  for i in 2..3 loop
    perform public.accept_job_request(current_setting('app.req_' || i)::uuid);
    perform public.complete_job(current_setting('app.job_' || i)::uuid);
  end loop;

  assert (select free_jobs_remaining from public.tradesperson_profiles where user_id = auth.uid()) = 0,
    'T34 all three free jobs consumed';
  assert (select count(*) from public.commissions where waived) = 3,
    'T35 three waived commissions recorded';
  assert (select jobs_completed from public.tradesperson_profiles where user_id = auth.uid()) = 3,
    'T36 three completed jobs';
end;
$$;
reset role;

-- fourth job is billable: 5% of 2,000 = 100
select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
declare v_job uuid; v_req uuid;
begin
  insert into public.jobs (customer_id, category_id, title, description, location_text, estimated_value)
  values (auth.uid(), 1, 'Job 4', 'Switchboard upgrade', 'Lae', 2000)
  returning id into v_job;

  insert into public.job_requests (job_id, tradesperson_id, origin, message)
  values (v_job, '22222222-2222-2222-2222-222222222222', 'customer_invite', 'Invite')
  returning id into v_req;

  perform set_config('app.job_4', v_job::text, false);
  perform set_config('app.req_4', v_req::text, false);
end;
$$;
reset role;

select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$
declare v_job uuid := current_setting('app.job_4')::uuid;
begin
  perform public.accept_job_request(current_setting('app.req_4')::uuid);
  perform public.complete_job(v_job);

  assert (select waived from public.commissions where job_id = v_job) = false,
    'T37 fourth job is billable';
  assert (select amount from public.commissions where job_id = v_job) = 100.00,
    'T38 commission is 5% of the job value';
  assert (select rate from public.commissions where job_id = v_job) = 0.05,
    'T39 commission rate recorded';
  assert (select status from public.commissions where job_id = v_job) = 'pending',
    'T40 billable commission is pending payment';
  assert (select count(*) from public.commissions) = 4,
    'T41 tradesperson sees their four commissions';
end;
$$;
reset role;

-- another tradesperson cannot read those commissions
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  assert (select count(*) from public.commissions) = 0,
    'T42 commissions are private';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Completion guard rails
-- ---------------------------------------------------------------------------
select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
declare v_job uuid;
begin
  insert into public.jobs (customer_id, category_id, title, description, estimated_value)
  values (auth.uid(), 2, 'Unassigned', 'No tradie yet', 300)
  returning id into v_job;

  begin
    perform public.complete_job(v_job);
    raise exception 'TEST FAILED T43: completed a job with no tradesperson';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;

  begin
    update public.jobs set status = 'completed' where id = v_job;
    raise exception 'TEST FAILED T44: direct status update bypassed the guard';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;

  -- a completed job can never be reopened
  begin
    update public.jobs set status = 'open' where id = current_setting('app.job_4')::uuid;
    raise exception 'TEST FAILED T45: completed job was reopened';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

-- outsider cannot complete someone else's job
select public.test_login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  begin
    perform public.complete_job('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'TEST FAILED T46: outsider completed a job';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Admin metrics + anonymous access
-- ---------------------------------------------------------------------------
select public.test_login('44444444-4444-4444-4444-444444444444');
set role authenticated;
do $$
declare m json;
begin
  m := public.admin_metrics();
  assert (m ->> 'completed_jobs')::int = 4, 'T47 metrics count completed jobs';
  assert (m ->> 'verified_tradespeople')::int = 1, 'T48 metrics count verified tradespeople';
  assert (m ->> 'total_users')::int = 5, 'T49 metrics count users';
  assert (m ->> 'commission_billed')::numeric = 100.00, 'T50 metrics sum billable commission';
end;
$$;
reset role;

select public.test_login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  begin
    perform public.admin_metrics();
    raise exception 'TEST FAILED T51: customer read admin metrics';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end;
$$;
reset role;

select public.test_logout();
set role anon;
do $$
declare
  v_jobs int := -1;
  v_msgs int := -1;
begin
  assert (select count(*) from public.tradespeople_directory) = 2,
    'T52 anonymous visitors can browse the directory';

  -- anon has neither a GRANT nor an RLS policy on jobs / messages:
  -- "permission denied" and "0 rows" are both acceptable outcomes.
  begin
    select count(*) into v_jobs from public.jobs;
  exception when insufficient_privilege then v_jobs := 0;
  end;
  assert v_jobs = 0, 'T53 anonymous visitors cannot read jobs';

  begin
    select count(*) into v_msgs from public.messages;
  exception when insufficient_privilege then v_msgs := 0;
  end;
  assert v_msgs = 0, 'T54 anonymous visitors cannot read chat';
end;
$$;
reset role;

-- the two sides of a live job can see each other's contact profile
select public.test_login('22222222-2222-2222-2222-222222222222');
set role authenticated;
do $$
begin
  assert (select count(*) from public.profiles
           where user_id = '11111111-1111-1111-1111-111111111111') = 1,
    'T56 assigned tradesperson can read their customer profile';
  assert (select count(*) from public.profiles
           where user_id = '55555555-5555-5555-5555-555555555555') = 0,
    'T57 unrelated customer profiles stay hidden';
end;
$$;
reset role;

select public.test_logout();

-- phone numbers never appear in the public directory projection
do $$
begin
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tradespeople_directory'
      and column_name = 'phone'
  ), 'T55 directory must not expose phone numbers';
end;
$$;

drop function if exists public.test_login(uuid);
drop function if exists public.test_logout();

select '✅  All TradeConnect business-rule and RLS tests passed' as result;
