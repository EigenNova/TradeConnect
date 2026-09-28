import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env';

/** Routes that require a signed-in user, mapped to the role that may enter. */
const ROLE_GATES: { prefix: string; role: 'customer' | 'tradesperson' | 'admin' }[] = [
  { prefix: '/customer', role: 'customer' },
  { prefix: '/tradesperson', role: 'tradesperson' },
  { prefix: '/admin', role: 'admin' },
];

const HOME_FOR_ROLE: Record<string, string> = {
  customer: '/customer/dashboard',
  tradesperson: '/tradesperson/dashboard',
  admin: '/admin/metrics',
};

/**
 * 1. Refreshes the Supabase auth cookies on every request (required by SSR).
 * 2. Blocks protected routes by role before any page code runs.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const gate = ROLE_GATES.find(
    (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`),
  );

  if (gate && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (gate && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const role = (profile?.role as string | undefined) ?? 'customer';

    if (role !== gate.role) {
      const url = request.nextUrl.clone();
      url.pathname = HOME_FOR_ROLE[role] ?? '/';
      url.search = '?denied=1';
      return NextResponse.redirect(url);
    }
  }

  // Signed-in users skip the auth screens.
  if (user && (pathname === '/login' || pathname === '/register')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = HOME_FOR_ROLE[(profile?.role as string) ?? 'customer'] ?? '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
