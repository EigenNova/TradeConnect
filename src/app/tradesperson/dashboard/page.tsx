import Link from 'next/link';
import JobCard from '@/components/JobCard';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, EmptyState, Field, PageHeader, Stars, Stat, VerifiedBadge } from '@/components/ui';
import { acceptRequestAction, declineRequestAction, submitQuoteAction } from '@/app/actions/jobs';
import {
  getMyCommissions,
  getMyRequests,
  getOpenLeads,
  getTradespersonCategoryIds,
  getTradespersonJobs,
  getTradespersonProfile,
} from '@/lib/data';
import { COMMISSION_RATE, kina, timeAgo } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function TradespersonDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const flags = await searchParams;
  const session = await requireRole('tradesperson', '/tradesperson/dashboard');

  const [profile, categoryIds] = await Promise.all([
    getTradespersonProfile(session.userId),
    getTradespersonCategoryIds(session.userId),
  ]);

  const [jobs, requests, leads, commissions] = await Promise.all([
    getTradespersonJobs(session.userId),
    getMyRequests(session.userId),
    getOpenLeads(categoryIds),
    getMyCommissions(session.userId),
  ]);

  const verified = profile?.verified_status === 'verified';
  const invites = requests.filter((r) => r.status === 'pending' && r.origin === 'customer_invite');
  const myQuoteJobIds = new Set(requests.map((r) => r.job_id));
  const activeJobs = jobs.filter((j) => j.status === 'assigned');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const owed = commissions
    .filter((c) => !c.waived && c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const freeLeft = profile?.free_jobs_remaining ?? 0;
  const openLeads = leads.filter((lead) => !myQuoteJobIds.has(lead.id));

  return (
    <div>
      <PageHeader
        title={`${session.profile.full_name.split(' ')[0] || 'Tradie'}'s dashboard`}
        subtitle="Leads, jobs and commissions."
        action={<VerifiedBadge status={profile?.verified_status ?? 'unverified'} />}
      />

      <div className="space-y-2">
        {flags.quoted && <Alert tone="success">Quote sent. The customer will be notified.</Alert>}
        {flags.accepted && <Alert tone="success">Job accepted — it is now in your active work.</Alert>}
        {flags.error && <Alert tone="error">{flags.error}</Alert>}
      </div>

      {!verified && (
        <Alert tone="warning" title="Get verified to start quoting">
          Upload your ID and trade certificate — an admin reviews it and then you can send quotes
          and accept jobs.{' '}
          <Link href="/tradesperson/verification" className="font-semibold underline">
            Upload documents →
          </Link>
        </Alert>
      )}

      {categoryIds.length === 0 && (
        <Alert tone="info">
          Add your trades so the right leads reach you.{' '}
          <Link href="/tradesperson/profile" className="font-semibold underline">
            Complete profile →
          </Link>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Free jobs left"
          value={freeLeft}
          hint={freeLeft > 0 ? 'No commission on these' : `${COMMISSION_RATE * 100}% applies now`}
          tone="gold"
        />
        <Stat label="Active jobs" value={activeJobs.length} tone="brand" />
        <Stat label="Completed" value={completedJobs.length} tone="emerald" />
        <Stat label="Commission owed" value={kina(owed)} hint="Paid off-platform" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* direct invites */}
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              Job requests for you {invites.length > 0 && `(${invites.length})`}
            </h2>
            {invites.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-500">
                  No direct requests right now. Customers can invite you from your profile in the
                  directory.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {invites.map((req) => {
                  const job = req.jobs;
                  return (
                    <Card key={req.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink-900">{job?.title ?? 'Job request'}</p>
                          <p className="text-xs text-ink-400">
                            {job?.categories?.name} · {job?.location_text} · {timeAgo(req.created_at)}
                          </p>
                        </div>
                        <p className="text-lg font-bold">{kina(job?.estimated_value ?? 0)}</p>
                      </div>
                      {job?.description && (
                        <p className="mt-2 line-clamp-3 text-sm text-ink-600">{job.description}</p>
                      )}
                      {req.message && <p className="mt-2 text-sm text-ink-500">“{req.message}”</p>}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={acceptRequestAction}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="back" value="/tradesperson/dashboard" />
                          <SubmitButton
                            className="tc-btn-primary px-3 py-2 text-xs"
                            pendingLabel="Accepting…"
                          >
                            Accept job
                          </SubmitButton>
                        </form>
                        <form action={declineRequestAction}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="back" value="/tradesperson/dashboard" />
                          <SubmitButton className="tc-btn-ghost px-3 py-2 text-xs" pendingLabel="…">
                            Decline
                          </SubmitButton>
                        </form>
                        {!verified && (
                          <p className="self-center text-xs text-brand-600">
                            Verification required before you can accept.
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* leads */}
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">
              Open leads in your trades {openLeads.length > 0 && `(${openLeads.length})`}
            </h2>
            {openLeads.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-500">
                  No open jobs in your trades right now. Check back soon.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {openLeads.map((lead) => (
                  <Card key={lead.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-900">{lead.title}</p>
                        <p className="text-xs text-ink-400">
                          {lead.categories?.name} · {lead.location_text} · {timeAgo(lead.created_at)}
                        </p>
                      </div>
                      <p className="text-lg font-bold">{kina(lead.estimated_value)}</p>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-ink-600">{lead.description}</p>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-600">
                        Send a quote
                      </summary>
                      <form action={submitQuoteAction} className="mt-3 space-y-3">
                        <input type="hidden" name="job_id" value={lead.id} />
                        <input type="hidden" name="back" value="/tradesperson/dashboard" />
                        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                          <Field label="Your price (K)">
                            <input
                              className="tc-input"
                              name="quoted_price"
                              type="number"
                              min="0"
                              step="10"
                              defaultValue={lead.estimated_value}
                              required
                            />
                          </Field>
                          <Field label="Message">
                            <input
                              className="tc-input"
                              name="message"
                              placeholder="I can start tomorrow at 8am"
                            />
                          </Field>
                        </div>
                        <SubmitButton
                          className="tc-btn-primary px-3 py-2 text-xs"
                          pendingLabel="Sending…"
                        >
                          {verified ? 'Send quote' : 'Send quote (verification required)'}
                        </SubmitButton>
                      </form>
                    </details>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* active work */}
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">My jobs</h2>
            {jobs.length === 0 ? (
              <EmptyState title="No jobs yet">
                Accept a request or send a quote to get your first job.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} href={`/tradesperson/jobs/${job.id}`} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-4">
          <Card>
            <p className="font-semibold text-ink-900">Your profile</p>
            <div className="mt-2 space-y-1 text-sm text-ink-600">
              <p>
                <Stars value={Number(profile?.rating_avg ?? 0)} count={profile?.rating_count ?? 0} />
              </p>
              <p>{profile?.service_area ?? 'Lae'}</p>
              <p className="text-xs text-ink-400">
                {profile?.bio ? profile.bio.slice(0, 90) : 'No bio yet — customers like to read one.'}
              </p>
            </div>
            <Link href="/tradesperson/profile" className="tc-btn-ghost mt-3 w-full">
              Edit profile
            </Link>
          </Card>

          <Card>
            <p className="font-semibold text-ink-900">Commission ledger</p>
            <p className="mt-1 text-xs text-ink-400">
              {COMMISSION_RATE * 100}% of the job value, charged only after completion. First{' '}
              {freeLeft > 0 ? `${freeLeft} more job${freeLeft === 1 ? '' : 's'} are` : 'three jobs were'}{' '}
              free.
            </p>

            {commissions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">Nothing yet — complete a job to see it here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100 text-sm">
                {commissions.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="min-w-0 truncate pr-2 text-ink-600">
                      {c.jobs?.title ?? 'Job'}{' '}
                      <span className="text-xs text-ink-400">({kina(c.job_value)})</span>
                    </span>
                    {c.waived ? (
                      <span className="tc-chip bg-emerald-100 text-emerald-700">Free job</span>
                    ) : (
                      <span className="font-semibold">{kina(c.amount)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
