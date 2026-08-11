export interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shelter_id: string | null;
  /** Ejerens identitet — bruges til login, ejer-claim og admin-opslag (lighed). Præcis én adresse. */
  owner_email: string;
  /** Ekstra modtagere af bookingnotifikationer. KUN notifikationer — aldrig adgangskontrol. */
  notify_emails: string[] | null;
  /**
   * Pris ejeren opkræver DIREKTE af gæsten (fx MobilePay ved ankomst).
   * Indgår ALDRIG i Stripe-opkrævningen — den kender kun `shelter_price_dkk`.
   * Se lib/onsite-price.ts.
   */
  onsite_price_dkk: number | null;
  onsite_price_basis: string | null;
  onsite_payment_note: string | null;
  owner_token: string;
  auth_user_id: string | null;
  max_persons: number;
  booking_mode: "shelterdk" | "iframe" | "both";
  ical_import_url: string | null;
  ical_last_synced_at: string | null;
  shelter_price_dkk: number | null;
  platform_fee_pct: number;
  platform_fee_min_dkk: number;
  payment_mode: "after_confirmation" | "upfront";
  cancellation_cutoff_hours: number; // default 48
  /**
   * Tidsfrist for samme-dag-booking i Europe/Copenhagen tid ("HH:MM:SS"
   * fra Postgres TIME). Null = ingen tidsfrist (default). Bookings til
   * fremtidige datoer berøres ikke.
   */
  same_day_booking_deadline: string | null;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";
export type BookingSource = "guest" | "owner_manual";

export interface ShelterBooking {
  id: string;
  bookable_shelter_id: string;
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string; // ISO date string "YYYY-MM-DD"
  check_out: string; // ISO date string "YYYY-MM-DD"
  message: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  guest_token: string;
  cancelled_at: string | null;
  cancelled_by: "owner" | "guest" | "system" | null;
  source: BookingSource;
  quoted_shelter_dkk: number | null;
  quoted_platform_dkk: number | null;
  quoted_total_dkk: number | null;
}

export type BookingAction = "confirm" | "reject" | "cancel";

export interface BookingActionToken {
  id: string;
  booking_id: string;
  action: BookingAction;
  token: string;
  expires_at: string;
  used_at: string | null;
}

export interface ShelterBlockedDate {
  id: string;
  bookable_shelter_id: string;
  blocked_date: string; // "YYYY-MM-DD"
  reason: string | null;
  source: "manual" | "ical_sync";
  created_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface BookingPayment {
  id: string;
  booking_id: string;
  stripe_checkout_session_id: string;
  amount_total_dkk: number;
  amount_shelter_dkk: number;
  amount_platform_dkk: number;
  status: PaymentStatus;
  payment_link_sent_at: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
}

export type PayoutStatus = "pending" | "paid";

export interface OwnerPayout {
  id: string;
  shelter_id: string;
  period_start: string;
  period_end: string;
  amount_dkk: number;
  status: PayoutStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Response shape for GET /api/book/[slug]/availability */
export interface AvailabilityResponse {
  dates: Record<string, "pending" | "confirmed" | "blocked">;
}

export type ShelterAvailabilityState =
  | "available"
  | "booked"
  | "partial"
  | "pending"
  | "confirmed"
  | "blocked"
  | "unknown";

export interface ShelterAvailabilityResponse {
  provider: "shelterdk" | "naturstyrelsen" | "unknown";
  mode: "internal_live" | "external_cached" | "external_unknown" | "none";
  source_url: string | null;
  lookup_key: string | null;
  last_synced_at: string | null;
  stale: boolean;
  has_data: boolean;
  unit_count: number;
  days: Record<string, ShelterAvailabilityState>;
}

/** Request body for POST /api/book/[slug] */
export interface CreateBookingBody {
  guest_name: string;
  guest_email: string;
  guest_count: number;
  check_in: string; // "YYYY-MM-DD"
  check_out: string; // "YYYY-MM-DD"
  message?: string;
}

export interface BookingMessage {
  id: string;
  booking_id: string;
  sender: "guest" | "owner";
  body: string;
  created_at: string;
  read_at: string | null;
}
