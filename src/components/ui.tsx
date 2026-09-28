import Link from 'next/link';
import type { ReactNode } from 'react';
import { JOB_STATUS_LABEL, JOB_STATUS_STYLE } from '@/lib/format';
import type { JobStatus, VerifiedStatus } from '@/lib/types';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`tc-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: JobStatus | string }) {
  return (
    <span className={`tc-chip ${JOB_STATUS_STYLE[status] ?? 'bg-ink-100 text-ink-600'}`}>
      {JOB_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function VerifiedBadge({ status }: { status: VerifiedStatus | string }) {
  if (status === 'verified') {
    return (
      <span className="tc-chip bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M10 1.5l2.2 1.6 2.7-.2.9 2.6 2.2 1.6-1 2.6 1 2.6-2.2 1.6-.9 2.6-2.7-.2L10 18.5l-2.2-1.6-2.7.2-.9-2.6L2 12.9l1-2.6-1-2.6 2.2-1.6.9-2.6 2.7.2L10 1.5zm3.6 6.1l-1.2-1.1-3.1 3.5-1.7-1.6-1.1 1.2 2.9 2.7 4.2-4.7z"
            clipRule="evenodd"
          />
        </svg>
        Verified
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="tc-chip bg-gold-100 text-gold-600">Verification pending</span>;
  }
  if (status === 'rejected') {
    return <span className="tc-chip bg-brand-100 text-brand-700">Verification rejected</span>;
  }
  return <span className="tc-chip bg-ink-100 text-ink-500">Not verified</span>;
}

export function Stars({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-gold-500" aria-hidden>
        {'★'.repeat(Math.max(rounded, 0))}
        <span className="text-ink-200">{'★'.repeat(Math.max(5 - rounded, 0))}</span>
      </span>
      <span className="text-ink-500">
        {value > 0 ? value.toFixed(1) : 'New'}
        {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
      </span>
    </span>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-gold-300 bg-gold-100 text-ink-800',
    error: 'border-brand-200 bg-brand-50 text-brand-800',
  } as const;

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  href,
  cta,
}: {
  title: string;
  children?: ReactNode;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="tc-card flex flex-col items-center gap-2 p-8 text-center">
      <p className="font-semibold text-ink-800">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-500">{children}</p>}
      {href && cta && (
        <Link href={href} className="tc-btn-primary mt-2">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'brand' | 'gold' | 'emerald';
}) {
  const tones = {
    default: 'text-ink-900',
    brand: 'text-brand-600',
    gold: 'text-gold-600',
    emerald: 'text-emerald-600',
  } as const;

  return (
    <div className="tc-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="tc-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}
