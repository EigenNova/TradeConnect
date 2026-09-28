'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';
import { HOME_FOR_ROLE } from '@/lib/session';
import type { Role } from '@/lib/types';

function backTo(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(backTo('/login', { error: error?.message ?? 'Could not sign in', next }));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  redirect(next || HOME_FOR_ROLE[(profile?.role as Role) ?? 'customer']);
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const city = String(formData.get('city') ?? 'Lae').trim();
  const role = (String(formData.get('role') ?? 'customer') as Role) === 'tradesperson'
    ? 'tradesperson'
    : 'customer';

  if (!fullName) redirect(backTo('/register', { error: 'Please enter your full name', role }));
  if (password.length < 8) {
    redirect(backTo('/register', { error: 'Password must be at least 8 characters', role }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
      data: { role, full_name: fullName, phone, city },
    },
  });

  if (error) redirect(backTo('/register', { error: error.message, role }));

  // Email confirmation switched on → no session yet.
  if (!data.session) {
    redirect(backTo('/login', { message: 'Check your email to confirm your account, then sign in.' }));
  }

  redirect(role === 'tradesperson' ? '/tradesperson/profile?welcome=1' : '/customer/dashboard');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
