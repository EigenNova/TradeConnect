import { createClient } from '@/lib/supabase/server';
import type {
  AdminMetrics,
  Category,
  Commission,
  DirectoryEntry,
  Job,
  JobRequest,
  Message,
  Rating,
  TradespersonProfile,
  Verification,
} from '@/lib/types';

const JOB_SELECT = `
  *,
  categories ( id, name, slug ),
  customer:profiles!jobs_customer_id_fkey ( user_id, full_name, phone, city ),
  tradesperson:profiles!jobs_assigned_tradesperson_id_fkey ( user_id, full_name, phone, city )
`;

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('id');
  return (data ?? []) as Category[];
}

/* ------------------------------------------------------------------ browse */

export async function getDirectory(filters: {
  categoryId?: number;
  city?: string;
  verifiedOnly?: boolean;
  limit?: number;
}): Promise<DirectoryEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from('tradespeople_directory')
    .select('*')
    .order('verified_status', { ascending: false }) // 'verified' first
    .order('rating_avg', { ascending: false })
    .order('jobs_completed', { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.categoryId) query = query.contains('category_ids', [filters.categoryId]);
  if (filters.city) query = query.ilike('city', `%${filters.city}%`);
  if (filters.verifiedOnly) query = query.eq('verified_status', 'verified');

  const { data } = await query;
  return (data ?? []) as DirectoryEntry[];
}

export async function getDirectoryEntry(userId: string): Promise<DirectoryEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tradespeople_directory')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as DirectoryEntry) ?? null;
}

export async function getReviewsFor(userId: string, limit = 5): Promise<Rating[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ratings')
    .select('*')
    .eq('tradesperson_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as Rating[];
}

/* ---------------------------------------------------------------- customer */

export async function getCustomerJobs(customerId: string): Promise<Job[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as Job[];
}

export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('id', jobId).maybeSingle();
  return (data as unknown as Job) ?? null;
}

export async function getJobRequests(jobId: string): Promise<JobRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_requests')
    .select('*, tradesperson:profiles!job_requests_tradesperson_id_fkey ( user_id, full_name, city )')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as JobRequest[];
}

export async function getMessages(jobId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Message[];
}

export async function getRating(jobId: string): Promise<Rating | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('ratings').select('*').eq('job_id', jobId).maybeSingle();
  return (data as Rating) ?? null;
}

/* ------------------------------------------------------------ tradesperson */

export async function getTradespersonProfile(
  userId: string,
): Promise<TradespersonProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tradesperson_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as TradespersonProfile) ?? null;
}

export async function getTradespersonCategoryIds(userId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tradesperson_categories')
    .select('category_id')
    .eq('user_id', userId);
  return (data ?? []).map((row: { category_id: number }) => row.category_id);
}

/** Jobs assigned to this tradesperson. */
export async function getTradespersonJobs(userId: string): Promise<Job[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('assigned_tradesperson_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as Job[];
}

/** Invites + quotes that involve this tradesperson. */
export async function getMyRequests(userId: string): Promise<JobRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_requests')
    .select(`*, jobs ( ${JOB_SELECT} )`)
    .eq('tradesperson_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as JobRequest[];
}

/** Open jobs the tradesperson can quote on (optionally filtered to trades). */
export async function getOpenLeads(categoryIds: number[]): Promise<Job[]> {
  const supabase = await createClient();
  let query = supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(30);

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);

  const { data } = await query;
  return (data ?? []) as unknown as Job[];
}

export async function getMyVerification(userId: string): Promise<Verification | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('verifications')
    .select('*')
    .eq('tradesperson_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Verification) ?? null;
}

export async function getMyCommissions(userId: string): Promise<Commission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('commissions')
    .select('*, jobs ( id, title, completed_at )')
    .eq('tradesperson_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as Commission[];
}

/* ------------------------------------------------------------------- admin */

export async function getPendingVerifications(): Promise<Verification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('verifications')
    .select(
      '*, tradesperson:profiles!verifications_tradesperson_id_fkey ( user_id, full_name, phone, city )',
    )
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as Verification[];
}

export async function getAllJobs(status?: string): Promise<Job[]> {
  const supabase = await createClient();
  let query = supabase.from('jobs').select(JOB_SELECT).order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query.limit(100);
  return (data ?? []) as unknown as Job[];
}

export async function getAdminMetrics(): Promise<AdminMetrics | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('admin_metrics');
  return (data as AdminMetrics) ?? null;
}

export async function getRecentCommissions(limit = 10): Promise<Commission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('commissions')
    .select('*, jobs ( id, title, completed_at )')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as Commission[];
}

/** Short-lived signed URLs for private verification documents (admin view). */
export async function signDocument(path: string, expiresIn = 300): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from('verification-docs')
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** How many pending quotes / invites each of these jobs has. */
export async function getRequestCounts(jobIds: string[]): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_requests')
    .select('job_id, status')
    .in('job_id', jobIds)
    .eq('status', 'pending');

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { job_id: string }) => {
    counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
  });
  return counts;
}
