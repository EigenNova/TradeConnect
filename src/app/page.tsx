import Link from 'next/link';
import TradieCard from '@/components/TradieCard';
import { Card } from '@/components/ui';
import { getDirectory } from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/env';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TRADES = [
  { slug: 'electrical', name: 'Electrical', blurb: 'Wiring, switchboards, solar, generators', icon: '⚡' },
  { slug: 'mechanical', name: 'Mechanical', blurb: 'Vehicle repairs, pumps, small engines', icon: '🔧' },
  { slug: 'plumbing', name: 'Plumbing', blurb: 'Leaks, tanks, drainage, hot water', icon: '🚿' },
];

export default async function LandingPage() {
  const session = await getSession();
  const featured = isSupabaseConfigured
    ? await getDirectory({ verifiedOnly: true, limit: 3 })
    : [];

  return (
    <div className="space-y-12">
      {/* hero */}
      <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <span className="tc-chip bg-brand-50 text-brand-700">Pilot · Lae, Morobe Province</span>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ink-900 sm:text-5xl">
            Find a <span className="text-brand-600">verified tradesperson</span> in Lae — today.
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-600">
            TradeConnect checks IDs and trade certificates before a tradie can quote, so you are
            not gambling on a stranger. Post your job, compare quotes, chat in the app, and pay the
            tradie directly.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={session?.profile.role === 'customer' ? '/customer/jobs/new' : '/register?role=customer'}
              className="tc-btn-primary"
            >
              Post a job — free
            </Link>
            <Link href="/browse" className="tc-btn-ghost">
              Browse tradies
            </Link>
          </div>

          <dl className="mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              { k: '3', v: 'trades in the pilot' },
              { k: '5%', v: 'commission on completion' },
              { k: '3 jobs', v: 'free for new tradies' },
            ].map((item) => (
              <div key={item.v} className="tc-card p-3">
                <dt className="text-lg font-bold text-ink-900">{item.k}</dt>
                <dd className="text-[11px] leading-tight text-ink-500">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Card className="bg-ink-900 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">
            How it works
          </p>
          <ol className="mt-4 space-y-4 text-sm">
            {[
              ['Post the job', 'Trade, description, location in Lae, and your budget.'],
              ['Get verified quotes', 'Only ID-checked, certificate-verified tradies can quote.'],
              ['Chat & agree', 'Message in the app, agree a time and a price.'],
              ['Complete & review', 'Mark the job done and rate the tradie for the next customer.'],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="text-ink-300">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* trades */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">Trades in the Lae pilot</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TRADES.map((trade) => (
            <Link key={trade.slug} href={`/browse?category=${trade.slug}`} className="tc-card p-4 transition hover:border-brand-300">
              <span className="text-2xl">{trade.icon}</span>
              <p className="mt-2 font-semibold text-ink-900">{trade.name}</p>
              <p className="text-sm text-ink-500">{trade.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* featured */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">Verified and ready to work</h2>
            <Link href="/browse" className="text-sm font-semibold text-brand-600 hover:underline">
              See all →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tradie) => (
              <TradieCard
                key={tradie.user_id}
                tradie={tradie}
                canHire={session?.profile.role === 'customer'}
              />
            ))}
          </div>
        </section>
      )}

      {/* tradie CTA */}
      <section className="tc-card overflow-hidden">
        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Are you a tradie in Lae?</h2>
            <p className="mt-2 text-sm text-ink-600">
              Get listed, get verified, get leads. Your <strong>first three completed jobs are
              commission-free</strong>. After that TradeConnect records a 5% commission when a job
              is marked complete — payment for the work itself stays between you and the customer.
            </p>
            <Link href="/register?role=tradesperson" className="tc-btn-dark mt-4">
              Join as a tradesperson
            </Link>
          </div>
          <ul className="space-y-2 text-sm text-ink-600">
            {[
              'Upload your ID and trade certificate once',
              'Admin verifies you — customers see the Verified badge',
              'Receive job requests and send quotes',
              'Mark the job complete and build your rating',
            ].map((point) => (
              <li key={point} className="flex gap-2">
                <span className="text-brand-600">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
