import { reviewVerificationAction } from '@/app/actions/admin';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui';
import { getPendingVerifications, signDocument } from '@/lib/data';
import { shortDate, timeAgo } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const flags = await searchParams;
  await requireRole('admin', '/admin/verifications');

  const all = await getPendingVerifications();
  const pending = all.filter((v) => v.status === 'pending');
  const reviewed = all.filter((v) => v.status !== 'pending').slice(0, 10);

  const withLinks = await Promise.all(
    pending.map(async (v) => ({
      ...v,
      idLink: await signDocument(v.id_doc_url),
      certLink: v.certificate_url ? await signDocument(v.certificate_url) : null,
    })),
  );

  return (
    <div>
      <PageHeader
        title="Verification queue"
        subtitle="Check the ID and trade certificate, then approve or reject. Approval switches on the Verified badge."
      />

      {flags.reviewed === 'approved' && <Alert tone="success">Tradesperson verified.</Alert>}
      {flags.reviewed === 'rejected' && <Alert tone="warning">Submission rejected.</Alert>}
      {flags.error && <Alert tone="error">{flags.error}</Alert>}

      {withLinks.length === 0 ? (
        <EmptyState title="Queue is clear">No submissions are waiting for review.</EmptyState>
      ) : (
        <div className="space-y-4">
          {withLinks.map((v) => (
            <Card key={v.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink-900">
                    {v.tradesperson?.full_name ?? 'Tradesperson'}
                  </p>
                  <p className="text-xs text-ink-400">
                    {v.tradesperson?.city} · {v.tradesperson?.phone ?? 'no phone'} · submitted{' '}
                    {timeAgo(v.created_at)}
                  </p>
                </div>
                <span className="tc-chip bg-gold-100 text-gold-600">Pending</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {v.idLink ? (
                  <a href={v.idLink} target="_blank" rel="noreferrer" className="tc-btn-ghost px-3 py-2 text-xs">
                    Open photo ID ↗
                  </a>
                ) : (
                  <span className="text-xs text-ink-400">ID file missing</span>
                )}
                {v.certLink && (
                  <a href={v.certLink} target="_blank" rel="noreferrer" className="tc-btn-ghost px-3 py-2 text-xs">
                    Open certificate ↗
                  </a>
                )}
                <span className="self-center text-[11px] text-ink-400">
                  Signed links expire in 5 minutes
                </span>
              </div>

              <form action={reviewVerificationAction} className="mt-4 space-y-3 border-t border-ink-100 pt-3">
                <input type="hidden" name="verification_id" value={v.id} />
                <input
                  className="tc-input"
                  name="notes"
                  placeholder="Optional note to the tradesperson (required reason if rejecting)"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approved"
                    className="tc-btn bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700"
                  >
                    Approve &amp; verify
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="rejected"
                    className="tc-btn-ghost border-brand-200 text-brand-700 hover:bg-brand-50"
                  >
                    Reject
                  </button>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Recently reviewed</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2">Tradesperson</th>
                  <th className="px-4 py-2">Decision</th>
                  <th className="px-4 py-2">Reviewed</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {reviewed.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-medium">{v.tradesperson?.full_name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`tc-chip ${
                          v.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-500">{shortDate(v.reviewed_at)}</td>
                    <td className="px-4 py-2 text-ink-500">{v.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
