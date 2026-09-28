import Link from 'next/link';
import { Stars, VerifiedBadge } from '@/components/ui';
import { kina } from '@/lib/format';
import type { DirectoryEntry } from '@/lib/types';

export default function TradieCard({
  tradie,
  canHire,
}: {
  tradie: DirectoryEntry;
  canHire: boolean;
}) {
  const initials = tradie.full_name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="tc-card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">
          {initials || 'TC'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink-900">{tradie.full_name}</p>
            <VerifiedBadge status={tradie.verified_status} />
          </div>
          <p className="mt-0.5 text-xs text-ink-400">
            {tradie.categories.join(' · ') || 'No trades listed'} · {tradie.service_area}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Stars value={Number(tradie.rating_avg)} count={tradie.rating_count} />
            <span className="text-xs text-ink-400">{tradie.jobs_completed} jobs done</span>
          </div>
        </div>
      </div>

      {tradie.bio && <p className="line-clamp-2 text-sm text-ink-600">{tradie.bio}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-sm text-ink-500">
          {tradie.hourly_rate ? `${kina(tradie.hourly_rate)}/hr` : 'Rate on request'}
        </span>
        {canHire ? (
          <Link
            href={`/customer/jobs/new?tradesperson=${tradie.user_id}`}
            className="tc-btn-primary px-3 py-2 text-xs"
          >
            Request this tradie
          </Link>
        ) : (
          <Link href="/register?role=customer" className="tc-btn-ghost px-3 py-2 text-xs">
            Sign up to hire
          </Link>
        )}
      </div>
    </div>
  );
}
