import Link from 'next/link';
import TradieCard from '@/components/TradieCard';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getCategories, getDirectory } from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/env';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string; verified?: string }>;
}) {
  const { category, city, verified } = await searchParams;

  if (!isSupabaseConfigured) {
    return (
      <EmptyState title="Supabase is not configured" href="/setup" cta="Open setup guide">
        Add your project URL and anon key to .env.local to load the directory.
      </EmptyState>
    );
  }

  const session = await getSession();
  const categories = await getCategories();
  const selected = categories.find((c) => c.slug === category);

  const tradies = await getDirectory({
    categoryId: selected?.id,
    city: city || undefined,
    verifiedOnly: verified === '1',
  });

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={`tc-chip border px-3 py-1.5 ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
      }`}
    >
      {label}
    </Link>
  );

  const keep = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries({ category, city, verified, ...params }).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const qs = sp.toString();
    return qs ? `/browse?${qs}` : '/browse';
  };

  return (
    <div>
      <PageHeader
        title="Tradespeople in Lae"
        subtitle={`${tradies.length} ${tradies.length === 1 ? 'tradie' : 'tradies'} listed · ID and certificate checked by the TradeConnect team`}
        action={
          session?.profile.role === 'customer' ? (
            <Link href="/customer/jobs/new" className="tc-btn-primary">
              Post a job
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {chip('All trades', keep({ category: undefined }), !selected)}
          {categories.map((c) =>
            chip(c.name, keep({ category: c.slug }), selected?.id === c.id),
          )}
          <span className="mx-1 hidden h-5 w-px bg-ink-200 sm:block" />
          {chip(
            'Verified only',
            keep({ verified: verified === '1' ? undefined : '1' }),
            verified === '1',
          )}
        </div>

        <form className="mt-3 flex gap-2" action="/browse">
          {category && <input type="hidden" name="category" value={category} />}
          {verified === '1' && <input type="hidden" name="verified" value="1" />}
          <input
            className="tc-input"
            name="city"
            defaultValue={city ?? ''}
            placeholder="Filter by city or suburb (e.g. Lae)"
          />
          <button className="tc-btn-dark" type="submit">
            Search
          </button>
        </form>
      </Card>

      {tradies.length === 0 ? (
        <EmptyState title="No tradies match that filter">
          Try another trade or clear the city filter. New tradies join the Lae pilot every week.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tradies.map((tradie) => (
            <TradieCard
              key={tradie.user_id}
              tradie={tradie}
              canHire={session?.profile.role === 'customer'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
