import Link from 'next/link';
import { updateTradespersonProfileAction } from '@/app/actions/profile';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field, PageHeader, VerifiedBadge } from '@/components/ui';
import { getCategories, getTradespersonCategoryIds, getTradespersonProfile } from '@/lib/data';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function TradespersonProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const flags = await searchParams;
  const session = await requireRole('tradesperson', '/tradesperson/profile');

  const [profile, categories, myCategoryIds] = await Promise.all([
    getTradespersonProfile(session.userId),
    getCategories(),
    getTradespersonCategoryIds(session.userId),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Your tradie profile"
        subtitle="This is what customers see in the directory."
        action={<VerifiedBadge status={profile?.verified_status ?? 'unverified'} />}
      />

      {flags.welcome && (
        <Alert tone="success" title="Welcome to TradeConnect">
          Fill in your trades and service area, then upload your documents to get the Verified
          badge.
        </Alert>
      )}
      {flags.saved && <Alert tone="success">Profile saved.</Alert>}
      {flags.error && <Alert tone="error">{flags.error}</Alert>}

      <Card>
        <form action={updateTradespersonProfileAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input className="tc-input" name="full_name" defaultValue={session.profile.full_name} required />
            </Field>
            <Field label="Phone">
              <input className="tc-input" name="phone" defaultValue={session.profile.phone ?? ''} placeholder="+675 …" />
            </Field>
          </div>

          <Field label="About your work" hint="Two or three sentences. Mention experience and specialities.">
            <textarea
              className="tc-input min-h-28"
              name="bio"
              defaultValue={profile?.bio ?? ''}
              placeholder="Licensed electrician with 8 years on industrial and domestic jobs around Lae…"
            />
          </Field>

          <fieldset>
            <legend className="tc-label">Trades you work in</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    name="category_ids"
                    value={c.id}
                    defaultChecked={myCategoryIds.includes(c.id)}
                    className="h-4 w-4 accent-[#ce1126]"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City">
              <input className="tc-input" name="city" defaultValue={session.profile.city} required />
            </Field>
            <Field label="Service area">
              <input
                className="tc-input"
                name="service_area"
                defaultValue={profile?.service_area ?? 'Lae'}
                placeholder="Lae and surrounds"
              />
            </Field>
            <Field label="Years experience">
              <input
                className="tc-input"
                name="years_experience"
                type="number"
                min="0"
                max="60"
                defaultValue={profile?.years_experience ?? 0}
              />
            </Field>
          </div>

          <Field label="Hourly rate (K, optional)">
            <input
              className="tc-input"
              name="hourly_rate"
              type="number"
              min="0"
              step="5"
              defaultValue={profile?.hourly_rate ?? ''}
            />
          </Field>

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
            <Link href="/tradesperson/verification" className="text-sm font-semibold text-brand-600 hover:underline">
              Verification documents →
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
