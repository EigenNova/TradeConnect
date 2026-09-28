import Link from 'next/link';
import { notFound } from 'next/navigation';
import Chat from '@/components/Chat';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, StatusBadge, Stars } from '@/components/ui';
import { completeJobAction, sendMessageAction } from '@/app/actions/jobs';
import { getJob, getMessages, getRating, getTradespersonProfile } from '@/lib/data';
import { COMMISSION_RATE, commissionPreview, kina, shortDate, timeAgo } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function TradespersonJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const session = await requireRole('tradesperson', `/tradesperson/jobs/${id}`);

  const job = await getJob(id);
  if (!job || job.assigned_tradesperson_id !== session.userId) notFound();

  const [messages, profile, rating] = await Promise.all([
    getMessages(job.id),
    getTradespersonProfile(session.userId),
    job.status === 'completed' ? getRating(job.id) : Promise.resolve(null),
  ]);

  const back = `/tradesperson/jobs/${job.id}`;
  const preview = commissionPreview(Number(job.estimated_value), profile?.free_jobs_remaining ?? 0);

  return (
    <div>
      <Link href="/tradesperson/dashboard" className="text-sm text-ink-500 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {job.categories?.name} · {job.location_text} · posted {timeAgo(job.created_at)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-4 space-y-2">
        {flags.completed && (
          <Alert tone="success" title="Job completed">
            The commission record has been created automatically.
          </Alert>
        )}
        {flags.error && <Alert tone="error">{flags.error}</Alert>}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">The job</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{job.description}</p>

            {job.photo_urls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {job.photo_urls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt="Job photo"
                    className="h-24 w-24 rounded-lg border border-ink-200 object-cover"
                  />
                ))}
              </div>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3 text-sm">
              <div>
                <dt className="text-xs text-ink-400">Agreed value</dt>
                <dd className="font-semibold">{kina(job.estimated_value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Customer</dt>
                <dd>{job.customer?.full_name ?? 'Customer'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Phone</dt>
                <dd>{job.customer?.phone ?? 'Use the chat'}</dd>
              </div>
              {job.completed_at && (
                <div>
                  <dt className="text-xs text-ink-400">Completed</dt>
                  <dd>{shortDate(job.completed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {job.status === 'assigned' && (
            <Card className="border-brand-200">
              <p className="font-semibold text-ink-900">Finished the work?</p>
              <p className="mt-1 text-sm text-ink-600">
                Marking complete records the platform commission and lets the customer review you.
              </p>
              <p className="mt-2 rounded-lg bg-ink-50 p-3 text-sm">
                {preview.waived ? (
                  <>
                    <span className="font-semibold text-emerald-700">Commission-free job</span> — you
                    have {profile?.free_jobs_remaining} free {profile?.free_jobs_remaining === 1 ? 'job' : 'jobs'} left.
                  </>
                ) : (
                  <>
                    Commission at {COMMISSION_RATE * 100}%:{' '}
                    <span className="font-semibold">{kina(preview.amount)}</span> of{' '}
                    {kina(job.estimated_value)}.
                  </>
                )}
              </p>
              <form action={completeJobAction} className="mt-3">
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton pendingLabel="Completing…">Mark job complete</SubmitButton>
              </form>
            </Card>
          )}

          {job.status === 'completed' && (
            <Card>
              <p className="font-semibold text-ink-900">Customer review</p>
              {rating ? (
                <div className="mt-2">
                  <Stars value={rating.stars} />
                  {rating.review_text && <p className="mt-2 text-sm text-ink-600">“{rating.review_text}”</p>}
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-500">No review yet.</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Chat
            jobId={job.id}
            currentUserId={session.userId}
            counterpartyId={job.customer_id}
            counterpartyName={job.customer?.full_name ?? 'the customer'}
            initialMessages={messages}
            backPath={back}
            sendAction={sendMessageAction}
          />
        </div>
      </div>
    </div>
  );
}
