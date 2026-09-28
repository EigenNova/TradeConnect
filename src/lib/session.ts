import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Profile, Role } from '@/lib/types';

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  customer: '/customer/dashboard',
  tradesperson: '/tradesperson/dashboard',
  admin: '/admin/metrics',
};

/** Current user + profile, memoised for the lifetime of one request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile) {
    return { userId: user.id, email: user.email ?? '', profile: profile as Profile };
  }

  // Self-heal: the handle_new_user trigger normally creates this row. If it is
  // missing (e.g. the account predates the migration) rebuild it from the auth
  // metadata instead of bouncing the user between /login and the dashboard.
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const role: Role = meta.role === 'tradesperson' ? 'tradesperson' : 'customer';

  const { data: created } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      role,
      full_name: meta.full_name ?? user.email?.split('@')[0] ?? '',
      phone: meta.phone ?? null,
      city: meta.city ?? 'Lae',
    })
    .select('*')
    .maybeSingle();

  if (!created) return null;

  if (role === 'tradesperson') {
    await supabase
      .from('tradesperson_profiles')
      .insert({ user_id: user.id, service_area: meta.city ?? 'Lae' });
  }

  return { userId: user.id, email: user.email ?? '', profile: created as Profile };
});

export async function requireUser(next = '/'): Promise<Session> {
  if (!isSupabaseConfigured) redirect('/setup');
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

/** Defence in depth: middleware already gates these routes by role. */
export async function requireRole(role: Role, next = '/'): Promise<Session> {
  const session = await requireUser(next);
  if (session.profile.role !== role) redirect(HOME_FOR_ROLE[session.profile.role]);
  return session;
}
