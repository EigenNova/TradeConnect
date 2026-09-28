# TradeConnect

A B2C marketplace that connects customers in **Lae, Papua New Guinea** with **verified
tradespeople** — pilot trades: **Electrical, Mechanical, Plumbing**.

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage +
Realtime).

The commercial rules — **5% commission on job completion, first 3 jobs per tradesperson free** —
are implemented as Postgres triggers, so they cannot be bypassed by any client.

---

## 1. Repo structure

```
TradeConnect/
├── middleware.ts                       # role-based route protection + session refresh
├── next.config.ts
├── postcss.config.mjs                  # Tailwind v4 via @tailwindcss/postcss
├── .env.example
├── scripts/
│   └── seed.mjs                        # demo data (accounts, jobs, chat, commissions)
├── supabase/
│   ├── config.toml                     # Supabase CLI config
│   ├── migrations/
│   │   ├── 20260928090000_schema.sql            # tables + indexes
│   │   ├── 20260928090100_functions_triggers.sql# is_admin(), commission engine, RPCs
│   │   ├── 20260928090200_rls_policies.sql      # row level security + grants + realtime
│   │   ├── 20260928090300_storage.sql           # buckets + storage policies
│   │   └── 20260928090400_reference_data.sql    # Electrical / Mechanical / Plumbing
│   └── tests/
│       ├── supabase_stubs.sql          # auth/storage stubs for a scratch Postgres
│       └── business_rules.test.sql     # 57 assertions: RLS + commissions + ratings
└── src/
    ├── app/
    │   ├── layout.tsx  globals.css  page.tsx          # shell + landing
    │   ├── login/  register/  setup/                  # auth screens + setup helper
    │   ├── auth/callback/route.ts                     # email confirmation handler
    │   ├── browse/page.tsx                            # public tradesperson directory
    │   ├── actions/                                   # all writes: server actions
    │   │   ├── auth.ts  jobs.ts  profile.ts  verification.ts  admin.ts
    │   ├── customer/
    │   │   ├── dashboard/page.tsx
    │   │   └── jobs/new/page.tsx   jobs/[id]/page.tsx
    │   ├── tradesperson/
    │   │   ├── dashboard/page.tsx  profile/page.tsx
    │   │   ├── verification/page.tsx
    │   │   └── jobs/[id]/page.tsx
    │   └── admin/
    │       ├── verifications/page.tsx  jobs/page.tsx  metrics/page.tsx
    ├── components/                     # Navbar, Chat (Realtime), cards, UI atoms
    └── lib/
        ├── supabase/{client,server,middleware}.ts     # @supabase/ssr wiring
        ├── data.ts                                    # typed read queries
        ├── session.ts                                 # getSession / requireRole
        ├── types.ts  format.ts  env.ts
```

---

## 2. Setup

### 2.1 Create the Supabase project

1. <https://supabase.com/dashboard> → **New project** (Sydney is the closest region to PNG).
2. **Project Settings → API** → copy the *Project URL*, *anon public* key and *service_role* key.
3. **Authentication → Providers → Email**: for the pilot demo switch **Confirm email → off** so
   accounts can sign in immediately (leave it on for production).
4. **Authentication → URL Configuration**: Site URL `http://localhost:3000`, redirect URL
   `http://localhost:3000/auth/callback`.

### 2.2 Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where it is used | Secret |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server clients | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server clients | no |
| `NEXT_PUBLIC_SITE_URL` | auth redirect (`/auth/callback`) | no |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/seed.mjs` only | **yes** |
| `SEED_PASSWORD` | password for the demo accounts (default `Demo1234!`) | — |

### 2.3 Run the migrations

**Option A — Supabase CLI (recommended)**

```bash
npm i -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push           # applies supabase/migrations in order
```

**Option B — SQL editor**

Paste the five files in `supabase/migrations/` into the Supabase SQL editor **in filename order**
and run them.

Storage buckets `verification-docs` (private) and `job-photos` (public) are created by
`20260928090300_storage.sql` — nothing to click in the dashboard.

### 2.4 Seed the demo data

```bash
npm run db:seed            # node --env-file=.env.local scripts/seed.mjs
```

Creates (password `Demo1234!` unless `SEED_PASSWORD` is set):

| Role | Email | Notes |
| --- | --- | --- |
| admin | `admin@tradeconnect.pg` | verification queue + metrics |
| customer | `mary.kaupa@example.com` | open job with a quote waiting, live chat, past reviews |
| customer | `peter.wali@example.com` | two open jobs |
| tradesperson | `joe.kila@example.com` | Electrical, verified, 4 completed → 3 waived + 1 billed |
| tradesperson | `linda.bani@example.com` | Mechanical, verified |
| tradesperson | `sam.toea@example.com` | Plumbing, verified, one job in progress |
| tradesperson | `nathan.gabi@example.com` | **pending verification** — left in the admin queue for the demo |

The seed drives the real triggers (assign → complete → commission), so the ledger it produces is
generated by the database.

### 2.5 Run the app

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

---

## 3. Data model

| Table | Purpose |
| --- | --- |
| `profiles` | one row per `auth.users` row: `role` (customer/tradesperson/admin), name, phone, city |
| `categories` | Electrical, Mechanical, Plumbing |
| `tradesperson_profiles` | bio, service area, `verified_status`, **`free_jobs_remaining` (default 3)**, rating cache |
| `tradesperson_categories` | many-to-many trades |
| `jobs` | `open → assigned → completed` (or `cancelled`), `estimated_value`, photos |
| `job_requests` | customer invites **and** tradesperson quotes (`origin`), `quoted_price` |
| `messages` | in-job chat, receiver derived by trigger |
| `ratings` | one per job, only after completion |
| `verifications` | ID + certificate paths, admin decision, reviewer stamp |
| `commissions` | one per completed job: `job_value`, `rate` (0.05), `amount`, `waived`, `status` |
| `tradespeople_directory` (view) | public projection for `/browse` — **no phone numbers** |

### Commission engine (`handle_job_completion`)

On `jobs.status → 'completed'`:

1. lock the tradesperson row (`select … for update`),
2. `free_jobs_remaining > 0` → insert a commission with `waived = true`, `amount = 0`,
   `status = 'waived'`, then decrement,
3. otherwise insert `amount = round(estimated_value * 0.05, 2)`, `status = 'pending'`,
4. `commissions.job_id` is unique and the insert is `on conflict do nothing`, so completing twice
   can never double-charge.

Payment stays off-platform — TradeConnect only records what is owed.

### Other rules enforced in the database

* `handle_new_user` clamps self-signup to `customer`/`tradesperson` (no self-made admins).
* `protect_profile_columns` / `protect_tradesperson_columns` — a user cannot change their own
  role, `verified_status`, `free_jobs_remaining` or rating cache.
* `enforce_job_transitions` — no completing an unassigned job, no reopening a completed one.
* `enforce_rating_rules` — reviews only on completed jobs; `customer_id`/`tradesperson_id` are
  rewritten from the job so they cannot be spoofed.
* `enforce_message_rules` — the receiver is derived from the job; chat opens only after assignment.
* `accept_job_request()` / `complete_job()` RPCs — atomic assignment (all other pending requests
  are declined) and completion, with participant checks.
* `admin_metrics()` — one round trip for the admin dashboard, admins only.

### Row Level Security (all tables, deny by default)

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | self, tradespeople (directory), people you share a job/request with, admins | self (role locked by trigger) |
| `jobs` | own jobs, assigned jobs, open leads for tradespeople, admins | customer owns; tradesperson uses RPCs |
| `job_requests` | the tradesperson + the job's customer + admins | verified tradespeople may quote; customers may invite |
| `messages` | sender + receiver + admins | sender must be a job participant |
| `ratings` | public | only the job's customer, only after completion |
| `verifications` | owner + admins | owner inserts, **admins only** review |
| `commissions` | owner + admins | triggers/admins only |
| `storage: verification-docs` | owner + admins (private bucket, signed URLs) | owner, path `<uid>/…` |
| `storage: job-photos` | public | owner, path `<uid>/…` |

---

## 4. Testing the database rules

`supabase/tests/business_rules.test.sql` contains 57 assertions covering RLS, the commission
engine, review gating and the guard triggers. Against a scratch Postgres:

```bash
createdb tradeconnect_test
psql tradeconnect_test -f supabase/tests/supabase_stubs.sql      # fake auth/storage schemas
for f in supabase/migrations/*.sql; do psql tradeconnect_test -f "$f"; done
psql tradeconnect_test -f supabase/tests/business_rules.test.sql
# → ✅  All TradeConnect business-rule and RLS tests passed
```

Against a local Supabase stack (`supabase start`) skip the stubs file and point `psql` at
`postgresql://postgres:postgres@localhost:54322/postgres`.

---

## 5. Notes for the pilot

* **Mobile first / low bandwidth** — server-rendered pages, no client data fetching on load,
  forms are plain HTML `<form>` + server actions so they work on slow 3G and with JS disabled.
  Chat upgrades to Supabase Realtime when the socket connects and falls back to 8s polling.
* **Verification gate** — only tradespeople with an approved submission can quote or be assigned
  (enforced by RLS + `accept_job_request`).
* **Roles** — `/customer/*`, `/tradesperson/*` and `/admin/*` are gated in `middleware.ts` and
  re-checked server-side by `requireRole()`.
* **Making an admin** — sign up normally, then run in the SQL editor:
  `update public.profiles set role = 'admin' where user_id = '<uuid>';`
* **Deploy** — Vercel: add the three `NEXT_PUBLIC_*` vars (plus the service key if you seed from
  CI), set `NEXT_PUBLIC_SITE_URL` to the deployed URL and add `<url>/auth/callback` to the
  Supabase redirect list.

See **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)** for the 3–5 minute pitch-day click path.
