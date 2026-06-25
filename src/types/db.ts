// Shared row types for Phase 1-3 feature tables. Hand-written (no generated
// Supabase types yet); keep in sync with supabase/migrations/0007*.

export type Gender = "male" | "female" | "other";
export type MembershipState = "active" | "cancelled";
export type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer" | "other";

// Derived in the member_with_status view, not stored.
export type MembershipStatus =
  | "active"
  | "expiring"
  | "expired"
  | "cancelled"
  | "none";

export interface Member {
  id: string;
  gym_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
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
  created_at: string;
}

// member_with_status view row
export interface MemberWithStatus extends Member {
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
  created_at: string;
}

export interface Payment {
  id: string;
  gym_id: string;
  member_id: string | null;
  member_name: string | null;
  subscription_id: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  invoice_number: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}
