import Link from 'next/link';
import { notFound } from 'next/navigation';
import Chat from '@/components/Chat';
import StarPicker from '@/components/StarPicker';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field, StatusBadge, Stars, VerifiedBadge } from '@/components/ui';
import {
  acceptRequestAction,
  cancelJobAction,
  completeJobAction,
  declineRequestAction,
  sendMessageAction,
  submitReviewAction,
} from '@/app/actions/jobs';
import {
  getDirectoryEntry,
  getJob,
  getJobRequests,
  getMessages,
  getRating,
} from '@/lib/data';
import { kina, shortDate, timeAgo } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CustomerJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const session = await requireRole('customer', `/customer/jobs/${id}`);

  const job = await getJob(id);
  if (!job || job.customer_id !== session.userId) notFound();

  const [requests, messages, rating] = await Promise.all([
    getJobRequests(job.id),
    job.assigned_tradesperson_id ? getMessages(job.id) : Promise.resolve([]),
    job.status === 'completed' ? getRating(job.id) : Promise.resolve(null),
  ]);

  const assignedProfile = job.assigned_tradesperson_id
    ? await getDirectoryEntry(job.assigned_tradesperson_id)
    : null;

  const pending = requests.filter((r) => r.status === 'pending');
  const back = `/customer/jobs/${job.id}`;

  return (
    <div>
      <Link href="/customer/dashboard" className="text-sm text-ink-500 hover:underline">
        ← Back to my jobs
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
        {flags.posted && <Alert tone="success">Job posted. Verified tradies can now quote.</Alert>}
        {flags.invited && <Alert tone="success">Request sent to the tradie.</Alert>}
        {flags.accepted && <Alert tone="success">Tradie assigned — the chat is open below.</Alert>}
        {flags.completed && (
          <Alert tone="success" title="Job marked complete">
            A commission record was created for the tradesperson. Leave a review below.
          </Alert>
        )}
        {flags.reviewed && <Alert tone="success">Thanks — your review is live on their profile.</Alert>}
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
                <dt className="text-xs text-ink-400">Budget / value</dt>
                <dd className="font-semibold">{kina(job.estimated_value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Posted</dt>
                <dd>{shortDate(job.created_at)}</dd>
              </div>
              {job.completed_at && (
                <div>
                  <dt className="text-xs text-ink-400">Completed</dt>
                  <dd>{shortDate(job.completed_at)}</dd>
                </div>
              )}
            </dl>

            {job.status === 'open' && (
              <form action={cancelJobAction} className="mt-4 border-t border-ink-100 pt-3">
                <input type="hidden" name="job_id" value={job.id} />
                <button type="submit" className="text-xs text-ink-400 hover:text-brand-600 hover:underline">
                  Cancel this job
                </button>
              </form>
            )}
          </Card>

          {/* responses */}
          {job.status === 'open' && (
            <Card>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">
                  Responses {pending.length > 0 && `(${pending.length})`}
                </p>
                <Link href="/browse" className="text-xs font-semibold text-brand-600 hover:underline">
                  Invite another tradie →
                </Link>
              </div>

              {requests.length === 0 && (
                <p className="mt-3 text-sm text-ink-500">
                  No responses yet. Verified tradies in this trade can see your job on their leads
                  board.
                </p>
              )}

              <ul className="mt-3 space-y-3">
                {requests.map((req) => (
                  <li key={req.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-900">
                          {req.tradesperson?.full_name ?? 'Tradesperson'}
                        </p>
                        <p className="text-xs text-ink-400">
                          {req.origin === 'customer_invite' ? 'You invited them' : 'Quote received'} ·{' '}
                          {timeAgo(req.created_at)} · {req.status}
                        </p>
                      </div>
                      {req.quoted_price != null && (
                        <p className="text-lg font-bold text-ink-900">{kina(req.quoted_price)}</p>
                      )}
                    </div>

                    {req.message && <p className="mt-2 text-sm text-ink-600">“{req.message}”</p>}

                    {req.status === 'pending' && req.origin === 'tradesperson_quote' && (
                      <div className="mt-3 flex gap-2">
                        <form action={acceptRequestAction}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton className="tc-btn-primary px-3 py-2 text-xs" pendingLabel="Assigning…">
                            Accept quote
                          </SubmitButton>
                        </form>
                        <form action={declineRequestAction}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton className="tc-btn-ghost px-3 py-2 text-xs" pendingLabel="…">
                            Decline
                          </SubmitButton>
                        </form>
                        <Link
                          href={`/browse?category=${job.categories?.slug ?? ''}`}
                          className="self-center text-xs text-ink-400 hover:underline"
                        >
                          View profile
                        </Link>
                      </div>
                    )}

                    {req.status === 'pending' && req.origin === 'customer_invite' && (
                      <p className="mt-2 text-xs text-ink-400">Waiting for the tradie to accept.</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* assigned tradie */}
          {assignedProfile && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Assigned tradesperson
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-ink-900">
                    {assignedProfile.full_name} <VerifiedBadge status={assignedProfile.verified_status} />
                  </p>
                  <p className="text-xs text-ink-500">
                    {assignedProfile.categories.join(' · ')} · {job.tradesperson?.phone ?? 'phone hidden'}
                  </p>
                  <div className="mt-1">
                    <Stars value={Number(assignedProfile.rating_avg)} count={assignedProfile.rating_count} />
                  </div>
                </div>

                {job.status === 'assigned' && (
                  <form action={completeJobAction}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton pendingLabel="Completing…">Mark job complete</SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          )}

          {/* review */}
          {job.status === 'completed' && (
            <Card>
              <p className="font-semibold text-ink-900">Rate the work</p>
              {rating ? (
                <div className="mt-2">
                  <Stars value={rating.stars} />
                  {rating.review_text && (
                    <p className="mt-2 text-sm text-ink-600">“{rating.review_text}”</p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">Reviewed {shortDate(rating.created_at)}</p>
                </div>
              ) : (
                <form action={submitReviewAction} className="mt-3 space-y-3">
                  <input type="hidden" name="job_id" value={job.id} />
                  <StarPicker />
                  <Field label="Review (optional)">
                    <textarea
                      className="tc-input min-h-20"
                      name="review_text"
                      placeholder="On time, tidy work, fair price…"
                    />
                  </Field>
                  <SubmitButton pendingLabel="Posting…">Post review</SubmitButton>
                </form>
              )}
            </Card>
          )}
        </div>

        {/* chat */}
        <div className="space-y-4">
          {job.assigned_tradesperson_id ? (
            <Chat
              jobId={job.id}
              currentUserId={session.userId}
              counterpartyId={job.assigned_tradesperson_id}
              counterpartyName={job.tradesperson?.full_name ?? 'your tradie'}
              initialMessages={messages}
              backPath={back}
              sendAction={sendMessageAction}
            />
          ) : (
            <Card>
              <p className="font-semibold text-ink-900">Chat</p>
              <p className="mt-1 text-sm text-ink-500">
                The chat opens as soon as you accept a quote or a tradie accepts your request.
              </p>
            </Card>
          )}

          <Card className="bg-ink-50">
            <p className="text-sm font-semibold text-ink-800">How payment works</p>
            <p className="mt-1 text-xs text-ink-500">
              You pay the tradesperson directly (cash, bank transfer or mobile money).
              TradeConnect only records a 5% platform commission from the tradie once the job is
              complete — and their first three jobs are free.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
