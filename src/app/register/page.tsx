import Link from 'next/link';
import { signUpAction } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; role?: string }>;
}) {
  const { error, role } = await searchParams;
  const isTradie = role === 'tradesperson';

  return (
    <div className="mx-auto max-w-md py-4">
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-500">Free for customers and tradespeople.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/register?role=customer"
          className={`rounded-lg border px-3 py-3 text-center text-sm font-semibold transition ${
            !isTradie ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600'
          }`}
        >
          I need a tradie
        </Link>
        <Link
          href="/register?role=tradesperson"
          className={`rounded-lg border px-3 py-3 text-center text-sm font-semibold transition ${
            isTradie ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600'
          }`}
        >
          I am a tradie
        </Link>
      </div>

      <Card className="mt-4">
        {error && <Alert tone="error">{error}</Alert>}
        {!isSupabaseConfigured && (
          <Alert tone="warning">
            Supabase is not configured yet — see <Link href="/setup" className="underline">setup</Link>.
          </Alert>
        )}

        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="role" value={isTradie ? 'tradesperson' : 'customer'} />

          <Field label="Full name">
            <input className="tc-input" name="full_name" required placeholder="Joe Kumul" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className="tc-input" name="phone" placeholder="+675 7xxx xxxx" />
            </Field>
            <Field label="City">
              <input className="tc-input" name="city" defaultValue="Lae" required />
            </Field>
          </div>

          <Field label="Email">
            <input className="tc-input" type="email" name="email" required autoComplete="email" />
          </Field>

          <Field label="Password" hint="At least 8 characters.">
            <input
              className="tc-input"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>

          <SubmitButton className="tc-btn-primary w-full" pendingLabel="Creating account…">
            {isTradie ? 'Create tradie account' : 'Create account'}
          </SubmitButton>

          {isTradie && (
            <p className="text-xs text-ink-400">
              Next step: add your trades and upload your ID + certificate for verification.
            </p>
          )}
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-ink-500">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
