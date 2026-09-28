import Link from 'next/link';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { getAllJobs } from '@/lib/data';
import { kina, shortDate } from '@/lib/format';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FILTERS = ['all', 'open', 'assigned', 'completed', 'cancelled'] as const;

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  await requireRole('admin', '/admin/jobs');

  const active = status ?? 'all';
  const jobs = await getAllJobs(active);
  const value = jobs.reduce((sum, j) => sum + Number(j.estimated_value), 0);

  return (
    <div>
      <PageHeader
        title="All jobs"
        subtitle={`${jobs.length} jobs · ${kina(value)} total value`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/admin/jobs' : `/admin/jobs?status=${f}`}
            className={`tc-chip border px-3 py-1.5 capitalize ${
              active === f
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs for this filter" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Trade</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Tradesperson</th>
                <th className="px-4 py-2">Value</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {jobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="max-w-[220px] px-4 py-2">
                    <p className="truncate font-medium text-ink-900">{job.title}</p>
                    <p className="truncate text-xs text-ink-400">{job.location_text}</p>
                  </td>
                  <td className="px-4 py-2 text-ink-600">{job.categories?.name}</td>
                  <td className="px-4 py-2 text-ink-600">{job.customer?.full_name ?? '—'}</td>
                  <td className="px-4 py-2 text-ink-600">{job.tradesperson?.full_name ?? '—'}</td>
                  <td className="px-4 py-2 font-medium">{kina(job.estimated_value)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2 text-ink-500">{shortDate(job.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
