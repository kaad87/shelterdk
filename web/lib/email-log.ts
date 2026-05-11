import { createAdminClient } from "@/utils/supabase/server-admin";

export type EmailLogStatus = "sent" | "failed";
export type EmailLogCategory = "booking" | "owner_portal" | "monitor";

export interface EmailLogInput {
  category?: EmailLogCategory;
  emailType: string;
  status: EmailLogStatus;
  provider?: string;
  providerMessageId?: string | null;
  toEmail: string;
  subject: string;
  previewText?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  shelterId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EmailLogRow {
  id: string;
  created_at: string;
  category: EmailLogCategory;
  email_type: string;
  status: EmailLogStatus;
  provider: string;
  provider_message_id: string | null;
  to_email: string;
  subject: string;
  preview_text: string | null;
  booking_id: string | null;
  payment_id: string | null;
  shelter_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export async function recordEmailLog(input: EmailLogInput) {
  try {
    const { error } = await createAdminClient().from("email_logs").insert({
      category: input.category ?? "booking",
      email_type: input.emailType,
      status: input.status,
      provider: input.provider ?? "resend",
      provider_message_id: input.providerMessageId ?? null,
      to_email: input.toEmail,
      subject: input.subject,
      preview_text: input.previewText ?? null,
      booking_id: input.bookingId ?? null,
      payment_id: input.paymentId ?? null,
      shelter_id: input.shelterId ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.error("email log insert failed:", error);
    }
  } catch (err) {
    console.error("email log error:", err);
  }
}

export async function listEmailLogs(opts?: {
  status?: EmailLogStatus | "all";
  category?: EmailLogCategory | "all";
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
  let query = createAdminClient()
    .from("email_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }
  if (opts?.category && opts.category !== "all") {
    query = query.eq("category", opts.category);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Kunne ikke hente email-log: ${error.message}`);
  return (data ?? []) as EmailLogRow[];
}
