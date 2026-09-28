import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Create a Supabase project',
    body: (
      <>
        Go to <code className="rounded bg-ink-100 px-1">supabase.com/dashboard</code> → New project
        (region: Sydney is closest to PNG). Copy the Project URL, the anon key and the service_role
        key from <em>Project Settings → API</em>.
      </>
    ),
  },
  {
    title: '2. Add your environment variables',
    body: (
      <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100">
{`# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...`}
      </pre>
    ),
  },
  {
    title: '3. Run the migrations',
    body: (
      <>
        With the Supabase CLI: <code className="rounded bg-ink-100 px-1">supabase link --project-ref
        &lt;ref&gt;</code> then <code className="rounded bg-ink-100 px-1">supabase db push</code>.
        Or paste the five files in <code className="rounded bg-ink-100 px-1">supabase/migrations/</code>{' '}
        into the SQL editor, in filename order.
      </>
    ),
  },
  {
    title: '4. Seed the demo data',
    body: (
      <>
        <code className="rounded bg-ink-100 px-1">npm run db:seed</code> creates the admin, two
        customers, four tradespeople (three verified) and a set of jobs, quotes, chats and
        commissions for the pitch demo.
      </>
    ),
  },
];

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Finish the TradeConnect setup"
        subtitle="The app runs against your own Supabase project. Four steps, about five minutes."
      />

      {isSupabaseConfigured ? (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm font-semibold text-emerald-800">
            Supabase is configured — you are good to go.
          </p>
          <Link href="/" className="tc-btn-primary mt-3">
            Go to TradeConnect
          </Link>
        </Card>
      ) : (
        <Card className="mb-4 border-gold-300 bg-gold-100">
          <p className="text-sm text-ink-800">
            <strong>NEXT_PUBLIC_SUPABASE_URL</strong> / <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>{' '}
            are missing, so sign-in and data pages are disabled. Add them to{' '}
            <code>.env.local</code> and restart <code>npm run dev</code>.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {STEPS.map((step) => (
          <Card key={step.title}>
            <p className="font-semibold text-ink-900">{step.title}</p>
            <div className="mt-1 text-sm text-ink-600">{step.body}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
