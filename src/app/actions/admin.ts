'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Approve or reject a verification. RLS + triggers reject non-admins. */
export async function reviewVerificationAction(formData: FormData) {
  const id = String(formData.get('verification_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const back = '/admin/verifications';

  if (!['approved', 'rejected'].includes(decision)) {
    redirect(`${back}?error=${encodeURIComponent('Unknown decision')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('verifications')
    .update({ status: decision, notes: notes || null })
    .eq('id', id);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(back);
  revalidatePath('/admin/metrics');
  revalidatePath('/browse');
  redirect(`${back}?reviewed=${decision}`);
}

/** Record an off-platform commission payment. */
export async function markCommissionPaidAction(formData: FormData) {
  const id = String(formData.get('commission_id') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.from('commissions').update({ status: 'paid' }).eq('id', id);
  if (error) redirect(`/admin/metrics?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/metrics');
  redirect('/admin/metrics?paid=1');
}
