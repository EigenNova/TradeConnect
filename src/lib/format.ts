export const COMMISSION_RATE = 0.05;
export const FREE_JOBS = 3;

/** Papua New Guinean Kina */
export function kina(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-PG', {
    style: 'currency',
    currency: 'PGK',
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace('PGK', 'K')
    .replace(/\s+/, '');
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(value);
}

export function clockTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const JOB_STATUS_LABEL: Record<string, string> = {
  open: 'Open for quotes',
  assigned: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const JOB_STATUS_STYLE: Record<string, string> = {
  open: 'bg-gold-100 text-gold-600',
  assigned: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-ink-100 text-ink-500',
};

export const VERIFIED_LABEL: Record<string, string> = {
  unverified: 'Not verified',
  pending: 'Verification pending',
  verified: 'Verified',
  rejected: 'Verification rejected',
};

/** What the tradesperson will be charged if this job completes right now. */
export function commissionPreview(value: number, freeJobsRemaining: number) {
  const waived = freeJobsRemaining > 0;
  return {
    waived,
    amount: waived ? 0 : Math.round(value * COMMISSION_RATE * 100) / 100,
  };
}
