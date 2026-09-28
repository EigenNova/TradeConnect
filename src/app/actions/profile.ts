'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

export async function updateTradespersonProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createClient();
  const back = '/tradesperson/profile';

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: String(formData.get('full_name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || null,
      city: String(formData.get('city') ?? 'Lae').trim(),
    })
    .eq('user_id', session.userId);

  if (profileError) redirect(`${back}?error=${encodeURIComponent(profileError.message)}`);

  const hourly = Number(formData.get('hourly_rate') ?? 0);
  const { error: tpError } = await supabase
    .from('tradesperson_profiles')
    .upsert({
      user_id: session.userId,
      bio: String(formData.get('bio') ?? '').trim(),
      service_area: String(formData.get('service_area') ?? 'Lae').trim(),
      years_experience: Number(formData.get('years_experience') ?? 0) || 0,
      hourly_rate: hourly > 0 ? hourly : null,
    });

  if (tpError) redirect(`${back}?error=${encodeURIComponent(tpError.message)}`);

  // replace the trade selection
  const categoryIds = formData
    .getAll('category_ids')
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  await supabase.from('tradesperson_categories').delete().eq('user_id', session.userId);
  if (categoryIds.length) {
    await supabase
      .from('tradesperson_categories')
      .insert(categoryIds.map((id) => ({ user_id: session.userId, category_id: id })));
  }

  revalidatePath(back);
  revalidatePath('/tradesperson/dashboard');
  revalidatePath('/browse');
  redirect(`${back}?saved=1`);
}

export async function updateAccountAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const back = String(formData.get('back') ?? '/customer/dashboard');
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: String(formData.get('full_name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || null,
      city: String(formData.get('city') ?? 'Lae').trim(),
    })
    .eq('user_id', session.userId);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
