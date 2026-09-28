'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

function withError(path: string, message: string) {
  return `${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`;
}

/* -------------------------------------------------------------- post a job */

export async function createJobAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login?next=/customer/jobs/new');

  const categoryId = Number(formData.get('category_id'));
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const location = String(formData.get('location_text') ?? '').trim() || 'Lae';
  const estimated = Number(formData.get('estimated_value') ?? 0);
  const inviteId = String(formData.get('invite_tradesperson_id') ?? '').trim();

  if (!categoryId || !description) {
    redirect(withError('/customer/jobs/new', 'Choose a trade and describe the job'));
  }

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      customer_id: session.userId,
      category_id: categoryId,
      title: title || description.slice(0, 60),
      description,
      location_text: location,
      estimated_value: Number.isFinite(estimated) ? estimated : 0,
    })
    .select('id')
    .single();

  if (error || !job) {
    redirect(withError('/customer/jobs/new', error?.message ?? 'Could not post the job'));
  }

  // optional photos → public job-photos bucket, owned by the customer
  const photos = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const urls: string[] = [];
  for (const [index, photo] of photos.slice(0, 3).entries()) {
    const ext = (photo.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${session.userId}/${job.id}/${Date.now()}-${index}.${ext}`;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(path, bytes, { contentType: photo.type || 'image/jpeg', upsert: true });
    if (!uploadError) {
      const { data: pub } = supabase.storage.from('job-photos').getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
  }
  if (urls.length) {
    await supabase.from('jobs').update({ photo_urls: urls }).eq('id', job.id);
  }

  if (inviteId) {
    await supabase.from('job_requests').insert({
      job_id: job.id,
      tradesperson_id: inviteId,
      origin: 'customer_invite',
      message: String(formData.get('invite_message') ?? 'Are you available for this job?'),
    });
  }

  revalidatePath('/customer/dashboard');
  redirect(`/customer/jobs/${job.id}?posted=1`);
}

/* ------------------------------------------------------- requests / quotes */

export async function inviteTradespersonAction(formData: FormData) {
  const jobId = String(formData.get('job_id') ?? '');
  const tradespersonId = String(formData.get('tradesperson_id') ?? '');
  const message = String(formData.get('message') ?? 'Are you available for this job?');
  const back = `/customer/jobs/${jobId}`;

  const supabase = await createClient();
  const { error } = await supabase.from('job_requests').insert({
    job_id: jobId,
    tradesperson_id: tradespersonId,
    origin: 'customer_invite',
    message,
  });

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(`${back}?invited=1`);
}

export async function submitQuoteAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const jobId = String(formData.get('job_id') ?? '');
  const price = Number(formData.get('quoted_price') ?? 0);
  const message = String(formData.get('message') ?? '').trim();
  const back = String(formData.get('back') ?? '/tradesperson/dashboard');

  const supabase = await createClient();
  const { error } = await supabase.from('job_requests').insert({
    job_id: jobId,
    tradesperson_id: session.userId,
    origin: 'tradesperson_quote',
    message: message || 'I am available for this job.',
    quoted_price: Number.isFinite(price) && price > 0 ? price : null,
  });

  if (error) {
    redirect(
      withError(
        back,
        error.message.includes('row-level security')
          ? 'Only verified tradespeople can send quotes — upload your documents first.'
          : error.message,
      ),
    );
  }

  revalidatePath(back);
  redirect(`${back}?quoted=1`);
}

export async function acceptRequestAction(formData: FormData) {
  const requestId = String(formData.get('request_id') ?? '');
  const back = String(formData.get('back') ?? '/customer/dashboard');

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_job_request', { p_request_id: requestId });

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(`${back}?accepted=1`);
}

export async function declineRequestAction(formData: FormData) {
  const requestId = String(formData.get('request_id') ?? '');
  const back = String(formData.get('back') ?? '/tradesperson/dashboard');

  const supabase = await createClient();
  const { error } = await supabase
    .from('job_requests')
    .update({ status: 'declined' })
    .eq('id', requestId);

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(back);
}

/* -------------------------------------------------- completion + reviewing */

export async function completeJobAction(formData: FormData) {
  const jobId = String(formData.get('job_id') ?? '');
  const back = String(formData.get('back') ?? `/customer/jobs/${jobId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_job', { p_job_id: jobId });

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(`${back}?completed=1`);
}

export async function cancelJobAction(formData: FormData) {
  const jobId = String(formData.get('job_id') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId);
  if (error) redirect(withError(`/customer/jobs/${jobId}`, error.message));
  revalidatePath('/customer/dashboard');
  redirect('/customer/dashboard');
}

export async function submitReviewAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const jobId = String(formData.get('job_id') ?? '');
  const stars = Number(formData.get('stars') ?? 5);
  const review = String(formData.get('review_text') ?? '').trim();
  const back = `/customer/jobs/${jobId}`;

  const supabase = await createClient();
  const { error } = await supabase.from('ratings').insert({
    job_id: jobId,
    customer_id: session.userId,
    tradesperson_id: session.userId, // rewritten by the enforce_rating_rules trigger
    stars: Math.min(5, Math.max(1, stars)),
    review_text: review || null,
  });

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(`${back}?reviewed=1`);
}

/* ---------------------------------------------------------------- messages */

export async function sendMessageAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const jobId = String(formData.get('job_id') ?? '');
  const receiverId = String(formData.get('receiver_id') ?? '') || session.userId;
  const body = String(formData.get('body') ?? '').trim();
  const back = String(formData.get('back') ?? `/customer/jobs/${jobId}`);

  if (!body) redirect(back);

  const supabase = await createClient();
  const { error } = await supabase.from('messages').insert({
    job_id: jobId,
    sender_id: session.userId,
    receiver_id: receiverId, // rewritten by the enforce_message_rules trigger
    body,
  });

  if (error) redirect(withError(back, error.message));
  revalidatePath(back);
  redirect(back);
}
