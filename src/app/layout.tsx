import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import Navbar from '@/components/Navbar';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = {
  title: 'TradeConnect — verified tradespeople in Lae, PNG',
  description:
    'TradeConnect links customers in Lae with verified electricians, mechanics and plumbers. Post a job, compare quotes, chat, pay the tradie directly.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ce1126',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        {!isSupabaseConfigured && (
          <div className="bg-gold-500 px-4 py-2 text-center text-xs font-medium text-ink-900">
            Demo mode — Supabase is not configured yet.{' '}
            <Link href="/setup" className="underline">
              Finish setup
            </Link>
          </div>
        )}

        <Navbar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

        <footer className="border-t border-ink-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} TradeConnect · Lae pilot · Electrical · Mechanical · Plumbing</p>
            <p>Tradies keep 100% of the job. First 3 jobs free, then a 5% platform commission.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
