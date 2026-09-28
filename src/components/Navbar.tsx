import Link from 'next/link';
import { getSession } from '@/lib/session';
import { signOutAction } from '@/app/actions/auth';

const NAV_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  customer: [
    { href: '/customer/dashboard', label: 'My jobs' },
    { href: '/browse', label: 'Find a tradie' },
    { href: '/customer/jobs/new', label: 'Post a job' },
  ],
  tradesperson: [
    { href: '/tradesperson/dashboard', label: 'Dashboard' },
    { href: '/tradesperson/profile', label: 'Profile' },
    { href: '/tradesperson/verification', label: 'Verification' },
  ],
  admin: [
    { href: '/admin/metrics', label: 'Metrics' },
    { href: '/admin/verifications', label: 'Verifications' },
    { href: '/admin/jobs', label: 'Jobs' },
  ],
};

export default async function Navbar() {
  const session = await getSession();
  const links = session ? NAV_BY_ROLE[session.profile.role] : [{ href: '/browse', label: 'Browse tradies' }];

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
            TC
          </span>
          <span className="text-base font-bold tracking-tight">
            Trade<span className="text-brand-600">Connect</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 overflow-x-auto sm:gap-2">
          {links?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}

          {session ? (
            <form action={signOutAction} className="ml-1">
              <button className="tc-btn-ghost px-3 py-2 text-xs sm:text-sm" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link href="/login" className="tc-btn-ghost px-3 py-2 text-xs sm:text-sm">
                Log in
              </Link>
              <Link href="/register" className="tc-btn-primary px-3 py-2 text-xs sm:text-sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
