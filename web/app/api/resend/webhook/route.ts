import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Resend webhook handler.
 *
 * Configure in Resend dashboard → Webhooks:
 *   - URL: https://shelterdk.dk/api/resend/webhook
 *   - Events: email.bounced, email.complained, email.delivered, email.failed
 *
 * Updates the email_logs row to reflect delivery status and adds the
 * recipient to email_suppression when they hard-bounce or complain.
 * That table is consulted by the email-sender before we attempt a new
 * send to known-bad addresses (saves money + protects sender reputation).
 */

type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.failed";

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { type?: string };
  };
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false; // Refuse to process without signing key.
  const signatureHeader = req.headers.get("svix-signature") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const id = req.headers.get("svix-id") ?? "";
  if (!signatureHeader || !timestamp || !id) return false;

  // Resend signs via Svix: HMAC-SHA256(id.timestamp.body) base64.
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signed).digest("base64");

  // Header may contain multiple "v1,<sig>" pairs separated by spaces.
  for (const part of signatureHeader.split(" ")) {
    const [version, candidate] = part.split(",");
    if (version !== "v1" || !candidate) continue;
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function recipientsOf(event: ResendWebhookEvent): string[] {
  const to = event.data?.to;
  if (!to) return [];
  return Array.isArray(to) ? to : [to];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const messageId = event.data?.email_id ?? null;
  const recipients = recipientsOf(event);

  // 1. Update email_logs status (best-effort — table may not have the row
  //    if log insert failed at send time).
  if (messageId) {
    const statusByEvent: Record<string, string> = {
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
    };
    const newStatus = statusByEvent[event.type];
    if (newStatus) {
      await supabase
        .from("email_logs")
        .update({
          status: newStatus,
          delivery_event_at: event.created_at ?? new Date().toISOString(),
          delivery_metadata: event.data ?? null,
        })
        .eq("provider_message_id", messageId);
    }
  }

  // 2. Hard-bounce or complaint → suppress this address going forward.
  if (event.type === "email.bounced" || event.type === "email.complained") {
    const bounceType = event.data?.bounce?.type;
    const isHardBounce =
      event.type === "email.complained" ||
      bounceType === "Permanent" ||
      bounceType === "hard";

    if (isHardBounce && recipients.length > 0) {
      const rows = recipients.map((email) => ({
        email: email.toLowerCase(),
        reason: event.type,
        added_at: new Date().toISOString(),
      }));
      // Idempotent insert — if same address bounces twice, ignore conflict.
      await supabase
        .from("email_suppression")
        .upsert(rows, { onConflict: "email" });
    }
  }

  return NextResponse.json({ ok: true });
}
