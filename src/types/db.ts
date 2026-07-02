// Shared row types for Phase 1-3 feature tables. Hand-written (no generated
// Supabase types yet); keep in sync with supabase/migrations/0007*.

export type Gender = "male" | "female" | "other";
export type MembershipState = "active" | "cancelled";
// Discriminates the gym membership from add-on Personal Trainer plans. Both share
// the membership_plans / member_subscriptions tables (see migration 0018).
export type PlanKind = "membership" | "personal_trainer";
export type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer" | "other";
export type JoinRequestStatus = "pending" | "approved" | "rejected";
// How a member/payment row came to exist (attribution "how"). See migration 0030.
export type MemberSource = "manual" | "join_approval";
export type PaymentSource = "manual" | "plan" | "join_approval";

// Derived in the member_with_status view, not stored.
export type MembershipStatus =
  | "active"
  | "expiring"
  | "expired"
  | "cancelled"
  | "none";

export interface Gym {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string | null;
  join_token: string;
  upi_id: string | null;
  upi_payee_name: string | null;
  address: string | null;
  rules: string[];
  created_at: string;
}

export interface Member {
  id: string;
  gym_id: string;
  serial: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  emergency_phone: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  photo_url: string | null;
  address: string | null;
  notes: string | null;
  joined_at: string;
  is_active: boolean;
  created_by: string | null;
  source: MemberSource;
  group_id: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface MemberGroup {
  id: string;
  gym_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

// member_with_status view row
export interface MemberWithStatus extends Member {
  group_name: string | null;
  subscription_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  membership_status: MembershipStatus;
}

export interface MembershipPlan {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  kind: PlanKind;
  is_active: boolean;
  created_at: string;
}

export interface MemberSubscription {
  id: string;
  gym_id: string;
  member_id: string;
  plan_id: string | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: MembershipState;
  kind: PlanKind;
  created_at: string;
}

export interface Payment {
  id: string;
  gym_id: string;
  serial: number;
  member_id: string | null;
  member_name: string | null;
  subscription_id: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  invoice_number: string | null;
  paid_at: string;
  created_by: string | null;
  source: PaymentSource;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  gym_id: string;
  serial: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  emergency_phone: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  address: string | null;
  notes: string | null;
  photo_url: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_price: number | null;
  pt_plan_id: string | null;
  pt_plan_name: string | null;
  pt_plan_price: number | null;
  payment_method: PaymentMethod;
  payment_proof_url: string | null;
  status: JoinRequestStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// SaaS subscription (one per gym). Mirrors public.subscriptions
// (migrations 0001 + 0022). Distinct from member_subscriptions above.
export type SubPlan = "starter" | "professional" | "enterprise";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  gym_id: string;
  plan: SubPlan;
  status: SubStatus;
  current_period_end: string | null;
  /** Set when a super-admin has paused the gym's service; null when active. */
  paused_at: string | null;
  created_at: string;
}
