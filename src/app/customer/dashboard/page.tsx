import Link from 'next/link';
import JobCard from '@/components/JobCard';
import { Alert, Card, EmptyState, Field, PageHeader, Stat } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { updateAccountAction } from '@/app/actions/profile';
import { getCustomerJobs, getRequestCounts } from '@/lib/data';
import { kina } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CustomerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; denied?: string }>;
}) {
  const { saved, error, denied } = await searchParams;
  const session = await requireRole('customer', '/customer/dashboard');
  const jobs = await getCustomerJobs(session.userId);
  const counts = await getRequestCounts(jobs.map((j) => j.id));

  const open = jobs.filter((j) => j.status === 'open');
  const active = jobs.filter((j) => j.status === 'assigned');
  const done = jobs.filter((j) => j.status === 'completed');
  const spend = done.reduce((sum, j) => sum + Number(j.estimated_value), 0);

  return (
    <div>
      <PageHeader
        title={`Hi ${session.profile.full_name.split(' ')[0] || 'there'} 👋`}
        subtitle="Your jobs, quotes and messages in one place."
        action={
          <Link href="/customer/jobs/new" className="tc-btn-primary">
            Post a job
          </Link>
        }
      />

      {denied && <Alert tone="warning">That area is for another account type.</Alert>}
      {saved && <Alert tone="success">Contact details saved.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open jobs" value={open.length} tone="gold" />
        <Stat label="In progress" value={active.length} tone="brand" />
        <Stat label="Completed" value={done.length} tone="emerald" />
        <Stat label="Value completed" value={kina(spend)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">Open for quotes</h2>
            {open.length === 0 ? (
              <EmptyState title="No open jobs" href="/customer/jobs/new" cta="Post a job">
                Post a job and verified tradies in Lae can send you quotes.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {open.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    href={`/customer/jobs/${job.id}`}
                    footer={
                      counts[job.id] ? (
                        <p className="mt-2 text-xs font-semibold text-brand-600">
                          {counts[job.id]} new {counts[job.id] === 1 ? 'response' : 'responses'} waiting
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-ink-400">Waiting for quotes…</p>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold tracking-tight">In progress</h2>
              <div className="space-y-3">
                {active.map((job) => (
                  <JobCard key={job.id} job={job} href={`/customer/jobs/${job.id}`} />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold tracking-tight">Completed</h2>
              <div className="space-y-3">
                {done.map((job) => (
                  <JobCard key={job.id} job={job} href={`/customer/jobs/${job.id}`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="font-semibold text-ink-900">Your contact details</p>
            <p className="mt-1 text-xs text-ink-400">
              Shared with a tradie only after you accept their quote.
            </p>
            <form action={updateAccountAction} className="mt-3 space-y-3">
              <input type="hidden" name="back" value="/customer/dashboard" />
              <Field label="Full name">
                <input className="tc-input" name="full_name" defaultValue={session.profile.full_name} required />
              </Field>
              <Field label="Phone">
                <input className="tc-input" name="phone" defaultValue={session.profile.phone ?? ''} />
              </Field>
              <Field label="City">
                <input className="tc-input" name="city" defaultValue={session.profile.city} required />
              </Field>
              <SubmitButton className="tc-btn-ghost w-full" pendingLabel="Saving…">
                Save
              </SubmitButton>
            </form>
          </Card>

          <Card className="bg-ink-900 text-white">
            <p className="text-sm font-semibold">Need someone specific?</p>
            <p className="mt-1 text-xs text-ink-300">
              Browse verified tradies and invite one straight onto a new job.
            </p>
            <Link href="/browse" className="tc-btn-ghost mt-3 w-full">
              Browse tradies
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
