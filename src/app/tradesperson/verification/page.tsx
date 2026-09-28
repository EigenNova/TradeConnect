import Link from 'next/link';
import { submitVerificationAction } from '@/app/actions/verification';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field, PageHeader, VerifiedBadge } from '@/components/ui';
import { getMyVerification, getTradespersonProfile } from '@/lib/data';
import { shortDate } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const flags = await searchParams;
  const session = await requireRole('tradesperson', '/tradesperson/verification');

  const [profile, verification] = await Promise.all([
    getTradespersonProfile(session.userId),
    getMyVerification(session.userId),
  ]);

  const status = profile?.verified_status ?? 'unverified';
  const canSubmit = verification?.status !== 'pending';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Verification"
        subtitle="Customers only see quotes from ID-checked tradies. One upload, reviewed by the TradeConnect team."
        action={<VerifiedBadge status={status} />}
      />

      {flags.submitted && (
        <Alert tone="success" title="Documents submitted">
          An admin will review them shortly. You will see the Verified badge here once approved.
        </Alert>
      )}
      {flags.error && <Alert tone="error">{flags.error}</Alert>}

      {status === 'verified' && (
        <Alert tone="success" title="You are verified">
          Your profile shows the Verified badge and you can quote on jobs.{' '}
          <Link href="/tradesperson/dashboard" className="font-semibold underline">
            Go to leads →
          </Link>
        </Alert>
      )}

      {verification && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Latest submission
          </p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-ink-400">Status</p>
              <p className="font-semibold capitalize">{verification.status}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Submitted</p>
              <p>{shortDate(verification.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Reviewed</p>
              <p>{verification.reviewed_at ? shortDate(verification.reviewed_at) : 'Awaiting review'}</p>
            </div>
          </div>
          {verification.notes && (
            <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
              <span className="font-semibold">Admin note:</span> {verification.notes}
            </p>
          )}
        </Card>
      )}

      <Card>
        <p className="font-semibold text-ink-900">
          {verification ? 'Upload new documents' : 'Upload your documents'}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Stored in a private bucket. Only you and the TradeConnect admin can open them.
        </p>

        <form action={submitVerificationAction} className="mt-4 space-y-4">
          <Field label="Photo ID (required)" hint="Driver licence, passport or NID. JPG or PNG.">
            <input
              className="tc-input py-2 file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm"
              type="file"
              name="id_doc"
              accept="image/*,application/pdf"
              required
              disabled={!canSubmit}
            />
          </Field>

          <Field label="Trade certificate (optional but recommended)" hint="Trade qualification, licence or reference letter.">
            <input
              className="tc-input py-2 file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm"
              type="file"
              name="certificate"
              accept="image/*,application/pdf"
              disabled={!canSubmit}
            />
          </Field>

          {canSubmit ? (
            <SubmitButton pendingLabel="Uploading…">Submit for verification</SubmitButton>
          ) : (
            <p className="rounded-lg bg-gold-100 px-3 py-2 text-sm text-ink-700">
              Your submission is in the review queue. You will be notified here once an admin
              decides.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
