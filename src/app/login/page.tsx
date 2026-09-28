import Link from 'next/link';
import { signInAction } from '@/app/actions/auth';
import { SubmitButton } from '@/components/SubmitButton';
import { Alert, Card, Field } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-4">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-500">Log in to manage your jobs.</p>

      <Card className="mt-5">
        {error && <Alert tone="error">{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        {!isSupabaseConfigured && (
          <Alert tone="warning">
            Supabase is not configured yet — see <Link href="/setup" className="underline">setup</Link>.
          </Alert>
        )}

        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ''} />
          <Field label="Email">
            <input
              className="tc-input"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              className="tc-input"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>
          <SubmitButton className="tc-btn-primary w-full" pendingLabel="Signing in…">
            Log in
          </SubmitButton>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-ink-500">
        New here?{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
