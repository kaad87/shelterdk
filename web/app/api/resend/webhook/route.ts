import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { Webhook } from "svix";

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
  if (!secret) return false;
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Use Svix's official SDK to verify — handles the `whsec_` prefix
  // decoding, version selection, and timing-safe comparison correctly.
  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return true;
  } catch {
    return false;
  }
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
