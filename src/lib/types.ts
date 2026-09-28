/**
 * Hand-written row types for the TradeConnect schema.
 * Regenerate richer types any time with:
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Role = 'customer' | 'tradesperson' | 'admin';
export type JobStatus = 'open' | 'assigned' | 'completed' | 'cancelled';
export type VerifiedStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type RequestOrigin = 'customer_invite' | 'tradesperson_quote';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type CommissionStatus = 'pending' | 'waived' | 'paid' | 'cancelled';

export interface Profile {
  user_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  city: string;
  created_at: string;
}

export interface TradespersonProfile {
  user_id: string;
  bio: string;
  service_area: string;
  years_experience: number;
  hourly_rate: number | null;
  verified_status: VerifiedStatus;
  free_jobs_remaining: number;
  jobs_completed: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface DirectoryEntry {
  user_id: string;
  full_name: string;
  city: string;
  bio: string;
  service_area: string;
  years_experience: number;
  hourly_rate: number | null;
  verified_status: VerifiedStatus;
  jobs_completed: number;
  rating_avg: number;
  rating_count: number;
  categories: string[];
  category_ids: number[];
}

export interface Job {
  id: string;
  customer_id: string;
  category_id: number;
  title: string;
  description: string;
  location_text: string;
  photo_urls: string[];
  status: JobStatus;
  assigned_tradesperson_id: string | null;
  estimated_value: number;
  completed_at: string | null;
  created_at: string;
  categories?: Category | null;
  customer?: Pick<Profile, 'user_id' | 'full_name' | 'phone' | 'city'> | null;
  tradesperson?: Pick<Profile, 'user_id' | 'full_name' | 'phone' | 'city'> | null;
}

export interface JobRequest {
  id: string;
  job_id: string;
  tradesperson_id: string;
  origin: RequestOrigin;
  message: string;
  quoted_price: number | null;
  status: RequestStatus;
  created_at: string;
  tradesperson?: Pick<Profile, 'user_id' | 'full_name' | 'city'> | null;
  jobs?: Job | null;
}

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
}

export interface Rating {
  id: string;
  job_id: string;
  customer_id: string;
  tradesperson_id: string;
  stars: number;
  review_text: string | null;
  created_at: string;
}

export interface Verification {
  id: string;
  tradesperson_id: string;
  id_doc_url: string;
  certificate_url: string | null;
  status: VerificationStatus;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  tradesperson?: Pick<Profile, 'user_id' | 'full_name' | 'phone' | 'city'> | null;
}

export interface Commission {
  id: string;
  job_id: string;
  tradesperson_id: string;
  job_value: number;
  rate: number;
  amount: number;
  waived: boolean;
  status: CommissionStatus;
  created_at: string;
  jobs?: Pick<Job, 'id' | 'title' | 'completed_at'> | null;
}

export interface AdminMetrics {
  total_users: number;
  total_customers: number;
  total_tradespeople: number;
  verified_tradespeople: number;
  pending_verifications: number;
  total_jobs: number;
  open_jobs: number;
  assigned_jobs: number;
  completed_jobs: number;
  gross_job_value: number;
  commission_billed: number;
  commission_waived_count: number;
}
