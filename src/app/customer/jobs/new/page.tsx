import Link from 'next/link';
import { createJobAction } from '@/app/actions/jobs';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field, PageHeader, VerifiedBadge } from '@/components/ui';
import { getCategories, getDirectoryEntry } from '@/lib/data';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ tradesperson?: string; error?: string }>;
}) {
  const { tradesperson, error } = await searchParams;
  const session = await requireRole('customer', '/customer/jobs/new');
  const categories = await getCategories();
  const invitee = tradesperson ? await getDirectoryEntry(tradesperson) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Post a job"
        subtitle="Takes a minute. Verified tradies in Lae will respond with quotes."
      />

      {error && <Alert tone="error">{error}</Alert>}

      {invitee && (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-ink-600">This job will be sent directly to</p>
              <p className="flex items-center gap-2 font-semibold text-ink-900">
                {invitee.full_name} <VerifiedBadge status={invitee.verified_status} />
              </p>
              <p className="text-xs text-ink-500">{invitee.categories.join(' · ')}</p>
            </div>
            <Link href="/customer/jobs/new" className="text-xs font-semibold text-brand-700 hover:underline">
              Remove
            </Link>
          </div>
        </Card>
      )}

      <Card>
        <form action={createJobAction} className="space-y-4">
          {invitee && <input type="hidden" name="invite_tradesperson_id" value={invitee.user_id} />}

          <Field label="Trade">
            <select
              className="tc-input"
              name="category_id"
              required
              defaultValue={invitee?.category_ids?.[0] ?? ''}
            >
              <option value="" disabled>
                Choose a trade…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Job title">
            <input
              className="tc-input"
              name="title"
              required
              maxLength={80}
              placeholder="e.g. Kitchen power point keeps tripping"
            />
          </Field>

          <Field label="Describe the work" hint="What is broken, what you have tried, access times.">
            <textarea
              className="tc-input min-h-28"
              name="description"
              required
              placeholder="The power point in the kitchen trips the breaker whenever the kettle is on…"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              <input
                className="tc-input"
                name="location_text"
                defaultValue={session.profile.city || 'Lae'}
                placeholder="Suburb, Lae"
                required
              />
            </Field>
            <Field label="Budget / estimated value (K)" hint="Used for the 5% commission record.">
              <input
                className="tc-input"
                name="estimated_value"
                type="number"
                min="0"
                step="10"
                defaultValue={500}
                required
              />
            </Field>
          </div>

          <Field label="Photos (optional)" hint="Up to 3 photos. Keep them small — mobile data friendly.">
            <input
              className="tc-input py-2 file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm"
              type="file"
              name="photos"
              accept="image/*"
              multiple
            />
          </Field>

          {invitee && (
            <Field label="Message to the tradie">
              <input
                className="tc-input"
                name="invite_message"
                defaultValue="Are you available for this job?"
              />
            </Field>
          )}

          <div className="flex items-center gap-3 pt-1">
            <SubmitButton pendingLabel="Posting…">Post job</SubmitButton>
            <Link href="/customer/dashboard" className="text-sm text-ink-500 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
