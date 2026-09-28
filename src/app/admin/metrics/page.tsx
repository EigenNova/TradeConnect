import Link from 'next/link';
import { markCommissionPaidAction } from '@/app/actions/admin';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, PageHeader, Stat } from '@/components/ui';
import { getAdminMetrics, getRecentCommissions } from '@/lib/data';
import { COMMISSION_RATE, kina, shortDate } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const flags = await searchParams;
  await requireRole('admin', '/admin/metrics');

  const [metrics, commissions] = await Promise.all([getAdminMetrics(), getRecentCommissions(12)]);

  if (!metrics) {
    return <Alert tone="error">Could not load metrics — is the admin_metrics() function deployed?</Alert>;
  }

  return (
    <div>
      <PageHeader
        title="Pilot metrics"
        subtitle="Lae pilot · Electrical, Mechanical, Plumbing"
        action={
          <Link href="/admin/verifications" className="tc-btn-primary">
            Verification queue ({metrics.pending_verifications})
          </Link>
        }
      />

      {flags.paid && <Alert tone="success">Commission marked as paid.</Alert>}
      {flags.error && <Alert tone="error">{flags.error}</Alert>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={metrics.total_users} hint={`${metrics.total_customers} customers · ${metrics.total_tradespeople} tradies`} />
        <Stat label="Verified tradespeople" value={metrics.verified_tradespeople} tone="emerald" hint={`${metrics.pending_verifications} awaiting review`} />
        <Stat label="Completed jobs" value={metrics.completed_jobs} tone="brand" hint={`${metrics.total_jobs} posted in total`} />
        <Stat label="Commission billed" value={kina(metrics.commission_billed)} tone="gold" hint={`${metrics.commission_waived_count} free jobs waived`} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Open jobs" value={metrics.open_jobs} />
        <Stat label="In progress" value={metrics.assigned_jobs} />
        <Stat label="Completed job value" value={kina(metrics.gross_job_value)} hint={`Take rate ${COMMISSION_RATE * 100}% after 3 free jobs`} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold tracking-tight">Commission ledger</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Job value</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Commission</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Recorded</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-400">
                    No completed jobs yet.
                  </td>
                </tr>
              )}
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-[220px] truncate px-4 py-2 font-medium">
                    {c.jobs?.title ?? 'Job'}
                  </td>
                  <td className="px-4 py-2">{kina(c.job_value)}</td>
                  <td className="px-4 py-2 text-ink-500">{(Number(c.rate) * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2 font-semibold">{c.waived ? '—' : kina(c.amount)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`tc-chip ${
                        c.status === 'waived'
                          ? 'bg-emerald-100 text-emerald-700'
                          : c.status === 'paid'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gold-100 text-gold-600'
                      }`}
                    >
                      {c.status === 'waived' ? 'free job' : c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{shortDate(c.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    {c.status === 'pending' && !c.waived && (
                      <form action={markCommissionPaidAction}>
                        <input type="hidden" name="commission_id" value={c.id} />
                        <SubmitButton className="tc-btn-ghost px-3 py-1.5 text-xs" pendingLabel="…">
                          Mark paid
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
