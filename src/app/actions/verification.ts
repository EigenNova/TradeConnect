'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

const BACK = '/tradesperson/verification';

/**
 * Uploads ID + certificate into the PRIVATE verification-docs bucket under
 * `<user id>/…` (storage RLS only lets the owner and admins read them) and
 * opens a pending verification for the admin queue.
 */
export async function submitVerificationAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createClient();
  const idDoc = formData.get('id_doc');
  const certificate = formData.get('certificate');

  if (!(idDoc instanceof File) || idDoc.size === 0) {
    redirect(`${BACK}?error=${encodeURIComponent('A photo of your ID is required')}`);
  }

  async function upload(file: File, kind: string) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${session!.userId}/${kind}-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from('verification-docs')
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (error) throw new Error(error.message);
    return path;
  }

  let idPath: string;
  let certPath: string | null = null;

  try {
    idPath = await upload(idDoc, 'id');
    if (certificate instanceof File && certificate.size > 0) {
      certPath = await upload(certificate, 'certificate');
    }
  } catch (e) {
    redirect(`${BACK}?error=${encodeURIComponent((e as Error).message)}`);
  }

  const { error } = await supabase.from('verifications').insert({
    tradesperson_id: session.userId,
    id_doc_url: idPath!,
    certificate_url: certPath,
  });

  if (error) {
    const friendly = error.message.includes('verifications_one_pending_idx')
      ? 'You already have a submission waiting for review.'
      : error.message;
    redirect(`${BACK}?error=${encodeURIComponent(friendly)}`);
  }

  revalidatePath(BACK);
  revalidatePath('/tradesperson/dashboard');
  redirect(`${BACK}?submitted=1`);
}
