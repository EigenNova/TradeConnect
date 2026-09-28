import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import { kina, timeAgo } from '@/lib/format';
import type { Job } from '@/lib/types';

export default function JobCard({
  job,
  href,
  footer,
}: {
  job: Job;
  href: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="tc-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="block truncate font-semibold text-ink-900 hover:text-brand-600">
            {job.title || job.description.slice(0, 60)}
          </Link>
          <p className="mt-0.5 text-xs text-ink-400">
            {job.categories?.name ?? 'Trade'} · {job.location_text} · {timeAgo(job.created_at)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-ink-600">{job.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-ink-900">{kina(job.estimated_value)}</span>
        {job.tradesperson && (
          <span className="text-ink-500">Tradie: {job.tradesperson.full_name}</span>
        )}
        <Link href={href} className="ml-auto text-sm font-semibold text-brand-600 hover:underline">
          Open →
        </Link>
      </div>

      {footer}
    </div>
  );
}
