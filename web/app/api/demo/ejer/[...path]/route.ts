// Catch-all mock API for the demo owner dashboard.
// Returns appropriate empty/success responses for every endpoint
// OwnerDashboard calls — nothing is read from or written to the DB.
export const dynamic = "force-dynamic";

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const MESSAGE_TEMPLATE_DEFAULTS = {
  confirmation_enabled: true,
  confirmation_subject: "Din booking af {shelter_navn} er bekræftet",
  confirmation_body:
    "Hej {gæst_navn},\n\nDin booking er bekræftet — vi glæder os til at byde dig velkommen.\n\nAnkomst: {ankomst_dato}\nAfrejse: {afrejse_dato}\nVarighed: {antal_nætter} nætter\nAntal personer: {antal_personer}\n\nGod tur!",
  reminder_enabled: true,
  reminder_subject: "Reminder: du ankommer til {shelter_navn} i morgen",
  reminder_body:
    "Hej {gæst_navn},\n\nBare en reminder — du ankommer til {shelter_navn} i morgen ({ankomst_dato}).\n\nVi ses!",
};

function getLastSegment(path: string[]) {
  return path[path.length - 1] ?? "";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const last = getLastSegment(path);

  if (last === "messages") return Response.json(MESSAGE_TEMPLATE_DEFAULTS);
  if (last === "payments") return Response.json([]);
  if (last === "unread-counts") return Response.json({ counts: {} });
  // booking/[id]/messages
  if (path.at(-1) === "messages" && path.at(-3) === "booking") {
    return Response.json([]);
  }
  if (last === "sync") return Response.json({ success: true });

  return Response.json({});
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const last = getLastSegment(path);

  // Simulate a short delay
  await new Promise((r) => setTimeout(r, 400));

  if (last === "action") {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "";
    const newStatus =
      action === "confirm" ? "confirmed"
      : action === "reject" ? "rejected"
      : action === "cancel" ? "cancelled"
      : "pending";
    return Response.json({ success: true, status: newStatus });
  }

  if (last === "block") {
    const body = await req.json().catch(() => ({}));
    const unblock: boolean = body.unblock === true;
    return Response.json({ success: true, unblock, dates: [body.from ?? body.date] });
  }

  if (last === "manual") {
    const body = await req.json().catch(() => ({}));
    const booking = {
      id: "demo-manual-" + Date.now(),
      bookable_shelter_id: "demo",
      guest_name: body.guest_name ?? "Demo gæst",
      guest_email: body.guest_email ?? "demo@example.dk",
      guest_count: body.guest_count ?? 1,
      check_in: body.check_in ?? isoDate(1),
      check_out: body.check_out ?? isoDate(2),
      message: body.message ?? null,
      status: "confirmed" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guest_token: "demo-guest-token",
      cancelled_at: null,
      cancelled_by: null,
      source: "owner_manual" as const,
      quoted_shelter_dkk: null,
      quoted_platform_dkk: null,
      quoted_total_dkk: null,
    };
    return Response.json({ success: true, booking });
  }

  if (last === "messages") {
    return Response.json({ success: true });
  }

  if (last === "sync") {
    return Response.json({ success: true, synced: 0, message: "Demo: ingen iCal-synkronisering" });
  }

  // settings POST/PATCH
  return Response.json({ success: true });
}

export async function PATCH(req: Request, ctx: Parameters<typeof POST>[1]) {
  return POST(req, ctx);
}
