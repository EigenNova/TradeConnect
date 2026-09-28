#!/usr/bin/env node
/**
 * TradeConnect demo seed.
 *
 *   npm run db:seed            # reads .env.local
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Safe to re-run: the demo accounts are deleted and rebuilt every time.
 *
 * The script deliberately drives the real triggers (assign → complete →
 * commission), so the seeded ledger is produced by the database, not faked.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD || 'Demo1234!';

if (!url || !serviceKey) {
  console.error(
    '\n✖ Missing env. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local\n',
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const ok = (label, { error }) => {
  if (error) {
    console.error(`✖ ${label}: ${error.message}`);
    process.exit(1);
  }
  process.stdout.write(`· ${label}\n`);
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

/* ------------------------------------------------------------------ people */

const PEOPLE = [
  { key: 'admin',  email: 'admin@tradeconnect.pg',      role: 'customer',     full_name: 'Pilot Admin',  phone: '+675 7000 0000', city: 'Lae' },
  { key: 'mary',   email: 'mary.kaupa@example.com',     role: 'customer',     full_name: 'Mary Kaupa',   phone: '+675 7111 1111', city: 'Lae' },
  { key: 'peter',  email: 'peter.wali@example.com',     role: 'customer',     full_name: 'Peter Wali',   phone: '+675 7222 2222', city: 'Lae' },
  { key: 'joe',    email: 'joe.kila@example.com',       role: 'tradesperson', full_name: 'Joe Kila',     phone: '+675 7333 3333', city: 'Lae' },
  { key: 'linda',  email: 'linda.bani@example.com',     role: 'tradesperson', full_name: 'Linda Bani',   phone: '+675 7444 4444', city: 'Lae' },
  { key: 'sam',    email: 'sam.toea@example.com',       role: 'tradesperson', full_name: 'Sam Toea',     phone: '+675 7555 5555', city: 'Lae' },
  { key: 'nathan', email: 'nathan.gabi@example.com',    role: 'tradesperson', full_name: 'Nathan Gabi',  phone: '+675 7666 6666', city: 'Lae' },
];

const TRADIES = {
  joe: {
    categories: [1],
    bio: 'Licensed electrician, 9 years on domestic and light industrial work around Lae. Switchboards, generators and solar.',
    service_area: 'Lae, Bumbu, Eriku',
    years_experience: 9,
    hourly_rate: 85,
    verify: 'approved',
  },
  linda: {
    categories: [2],
    bio: 'Diesel and petrol mechanic. Mobile service — I come to your compound with tools and parts.',
    service_area: 'Lae and Nadzab road',
    years_experience: 12,
    hourly_rate: 70,
    verify: 'approved',
  },
  sam: {
    categories: [3],
    bio: 'Plumber for tanks, pumps, drainage and hot water. Fast leak repairs, weekend call-outs.',
    service_area: 'Lae city and Top Town',
    years_experience: 6,
    hourly_rate: 60,
    verify: 'approved',
  },
  nathan: {
    categories: [1, 3],
    bio: 'Electrical and plumbing maintenance. Recently finished my trade certificate at Lae Technical College.',
    service_area: 'Lae',
    years_experience: 2,
    hourly_rate: 45,
    verify: 'pending', // stays in the admin queue for the live demo
  },
};

const ids = {};

/* -------------------------------------------------------------- 1. accounts */

async function upsertPeople() {
  const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error(`✖ list users: ${error.message}`);
    process.exit(1);
  }

  for (const person of PEOPLE) {
    const existing = list.users.find((u) => u.email === person.email);
    if (existing) {
      await db.auth.admin.deleteUser(existing.id); // cascades all demo data
    }

    const { data, error: createError } = await db.auth.admin.createUser({
      email: person.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: person.role,
        full_name: person.full_name,
        phone: person.phone,
        city: person.city,
      },
    });

    if (createError) {
      console.error(`✖ create ${person.email}: ${createError.message}`);
      process.exit(1);
    }

    ids[person.key] = data.user.id;
    process.stdout.write(`· account ${person.email}\n`);
  }

  // the handle_new_user trigger clamps self-signup to customer/tradesperson,
  // so the pilot admin is promoted here with the service key
  ok(
    'promote admin',
    await db.from('profiles').update({ role: 'admin' }).eq('user_id', ids.admin),
  );
}

/* ------------------------------------------------- 2. tradie profiles + docs */

async function seedTradies() {
  for (const [key, tp] of Object.entries(TRADIES)) {
    const userId = ids[key];

    ok(
      `profile ${key}`,
      await db
        .from('tradesperson_profiles')
        .update({
          bio: tp.bio,
          service_area: tp.service_area,
          years_experience: tp.years_experience,
          hourly_rate: tp.hourly_rate,
        })
        .eq('user_id', userId),
    );

    await db.from('tradesperson_categories').delete().eq('user_id', userId);
    ok(
      `trades ${key}`,
      await db
        .from('tradesperson_categories')
        .insert(tp.categories.map((category_id) => ({ user_id: userId, category_id }))),
    );

    // every tradie submits documents; three of them get approved
    const { data: verification, error } = await db
      .from('verifications')
      .insert({
        tradesperson_id: userId,
        id_doc_url: `${userId}/id-demo.jpg`,
        certificate_url: `${userId}/certificate-demo.pdf`,
        created_at: daysAgo(12),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`✖ verification ${key}: ${error.message}`);
      process.exit(1);
    }

    if (tp.verify === 'approved') {
      ok(
        `verify ${key}`,
        await db
          .from('verifications')
          .update({ status: 'approved', reviewed_by: ids.admin, notes: 'ID and certificate sighted.' })
          .eq('id', verification.id),
      );
    }
  }
}

/* ----------------------------------------------------------------- 3. jobs */

async function createJob(job) {
  const { data, error } = await db.from('jobs').insert(job).select('id').single();
  if (error) {
    console.error(`✖ job "${job.title}": ${error.message}`);
    process.exit(1);
  }
  return data.id;
}

/** assign + complete through the real triggers so commissions are generated */
async function assignAndComplete(jobId, tradieId, { complete = true, completedAgo = 2 } = {}) {
  ok(
    'assign job',
    await db
      .from('jobs')
      .update({ assigned_tradesperson_id: tradieId, status: 'assigned' })
      .eq('id', jobId),
  );

  if (complete) {
    ok('complete job', await db.from('jobs').update({ status: 'completed' }).eq('id', jobId));
    await db.from('jobs').update({ completed_at: daysAgo(completedAgo) }).eq('id', jobId);
  }
}

async function seedJobs() {
  /* --- open job with a quote waiting (customer demo starts here) ---------- */
  const j1 = await createJob({
    customer_id: ids.mary,
    category_id: 1,
    title: 'Kitchen power point keeps tripping',
    description:
      'Every time we plug in the kettle the breaker trips. Two power points in the kitchen are dead. House is in Eriku, someone home after 4pm.',
    location_text: 'Eriku, Lae',
    estimated_value: 600,
    created_at: daysAgo(1),
  });
  ok(
    'quote from Joe',
    await db.from('job_requests').insert({
      job_id: j1,
      tradesperson_id: ids.joe,
      origin: 'tradesperson_quote',
      message: 'I can come tomorrow 8am, will test the circuit and replace the points.',
      quoted_price: 550,
      created_at: daysAgo(1),
    }),
  );

  /* --- open job, no responses yet (lead board demo) ---------------------- */
  await createJob({
    customer_id: ids.peter,
    category_id: 3,
    title: 'Water tank pump not priming',
    description: 'Pump runs but no water reaches the tank. Needs a plumber to check the foot valve.',
    location_text: 'Top Town, Lae',
    estimated_value: 350,
    created_at: daysAgo(1),
  });

  await createJob({
    customer_id: ids.peter,
    category_id: 2,
    title: 'Hilux service and brake check',
    description: '2015 Hilux, 180k km. Full service plus the front brakes are squealing.',
    location_text: 'Nadzab road, Lae',
    estimated_value: 1200,
    created_at: daysAgo(3),
  });

  /* --- in-progress job with a live chat ---------------------------------- */
  const j4 = await createJob({
    customer_id: ids.mary,
    category_id: 3,
    title: 'Bathroom leak under the sink',
    description: 'Water pooling under the vanity, the cupboard is starting to swell.',
    location_text: 'Bumbu, Lae',
    estimated_value: 900,
    created_at: daysAgo(4),
  });
  ok(
    'invite Sam',
    await db.from('job_requests').insert({
      job_id: j4,
      tradesperson_id: ids.sam,
      origin: 'customer_invite',
      message: 'Can you look at this today or tomorrow?',
      created_at: daysAgo(4),
    }),
  );
  await assignAndComplete(j4, ids.sam, { complete: false });
  await db.from('job_requests').update({ status: 'accepted' }).eq('job_id', j4);

  const chat = [
    [ids.sam, 'Morning Mary, I can be there at 2pm today. Is someone home?'],
    [ids.mary, 'Yes I will be home from 1pm. Thank you Sam.'],
    [ids.sam, 'Good. I will bring a new P-trap and seals just in case.'],
    [ids.mary, 'Perfect, see you then.'],
  ];
  for (const [sender, body] of chat) {
    ok(
      'chat message',
      await db.from('messages').insert({
        job_id: j4,
        sender_id: sender,
        receiver_id: sender === ids.sam ? ids.mary : ids.sam,
        body,
        created_at: daysAgo(1),
      }),
    );
  }

  /* --- Joe: three free jobs then a billable one -------------------------- */
  const joeHistory = [
    { title: 'Replace switchboard at trade store', value: 1500, stars: 5, review: 'Neat work, finished the same day.' },
    { title: 'Install security lights', value: 800, stars: 5, review: 'On time and fair price.' },
    { title: 'Generator changeover switch', value: 1100, stars: 4, review: 'Good job, arrived a bit late.' },
    { title: 'Rewire office partition', value: 2000, stars: 5, review: 'Excellent, will use again.' },
  ];

  for (const [index, entry] of joeHistory.entries()) {
    const jobId = await createJob({
      customer_id: index % 2 === 0 ? ids.mary : ids.peter,
      category_id: 1,
      title: entry.title,
      description: `${entry.title} — completed through the TradeConnect Lae pilot.`,
      location_text: 'Lae',
      estimated_value: entry.value,
      created_at: daysAgo(30 - index * 6),
    });
    await assignAndComplete(jobId, ids.joe, { completedAgo: 28 - index * 6 });
    ok(
      'review',
      await db.from('ratings').insert({
        job_id: jobId,
        customer_id: index % 2 === 0 ? ids.mary : ids.peter,
        tradesperson_id: ids.joe,
        stars: entry.stars,
        review_text: entry.review,
        created_at: daysAgo(27 - index * 6),
      }),
    );
  }

  /* --- Linda + Sam: one completed job each (free) ------------------------ */
  const lindaJob = await createJob({
    customer_id: ids.peter,
    category_id: 2,
    title: 'Landcruiser radiator replacement',
    description: 'Overheating on the Highlands run, radiator replaced on site.',
    location_text: 'Lae',
    estimated_value: 1400,
    created_at: daysAgo(9),
  });
  await assignAndComplete(lindaJob, ids.linda, { completedAgo: 7 });
  ok(
    'review Linda',
    await db.from('ratings').insert({
      job_id: lindaJob,
      customer_id: ids.peter,
      tradesperson_id: ids.linda,
      stars: 5,
      review_text: 'Came to us, fixed it in three hours. Very good mechanic.',
      created_at: daysAgo(7),
    }),
  );

  const samJob = await createJob({
    customer_id: ids.mary,
    category_id: 3,
    title: 'Hot water system replacement',
    description: 'Old unit failed, new 250L system installed and tested.',
    location_text: 'Lae',
    estimated_value: 2200,
    created_at: daysAgo(15),
  });
  await assignAndComplete(samJob, ids.sam, { completedAgo: 13 });
  ok(
    'review Sam',
    await db.from('ratings').insert({
      job_id: samJob,
      customer_id: ids.mary,
      tradesperson_id: ids.sam,
      stars: 5,
      review_text: 'Clean install, explained how to use it.',
      created_at: daysAgo(12),
    }),
  );
}

/* ---------------------------------------------------------------- summary */

async function summary() {
  const { data: metrics } = await db.rpc('admin_metrics');
  const { data: joe } = await db
    .from('tradesperson_profiles')
    .select('free_jobs_remaining, jobs_completed, rating_avg')
    .eq('user_id', ids.joe)
    .single();

  console.log('\n──────────────────────────────────────────────');
  console.log(' TradeConnect demo data ready');
  console.log('──────────────────────────────────────────────');
  console.log(` password for every account: ${PASSWORD}\n`);
  PEOPLE.forEach((p) => {
    const label = p.key === 'admin' ? 'admin' : p.role;
    console.log(`  ${label.padEnd(13)} ${p.email}`);
  });
  console.log('\n  Joe Kila:', joe);
  console.log('  Metrics :', metrics);
  console.log('\n  Nathan Gabi is waiting in /admin/verifications for the live demo.\n');
}

await upsertPeople();
await seedTradies();
await seedJobs();
await summary();
