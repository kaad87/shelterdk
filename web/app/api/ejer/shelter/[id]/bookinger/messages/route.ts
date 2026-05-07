import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  confirmation_enabled: true,
  confirmation_subject: "Din booking af {shelter_navn} er bekræftet",
  confirmation_body:
    "Hej {gæst_navn},\n\nDin booking er bekræftet — vi glæder os til at byde dig velkommen.\n\nAnkomst: {ankomst_dato}\nAfrejse: {afrejse_dato}\nVarighed: {antal_nætter} nætter\nAntal personer: {antal_personer}\n\nGod tur!",
  reminder_enabled: true,
  reminder_subject: "Reminder: du ankommer til {shelter_navn} i morgen",
  reminder_body:
    "Hej {gæst_navn},\n\nBare en reminder — du ankommer til {shelter_navn} i morgen ({ankomst_dato}).\n\nVi ses!",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("booking_message_templates")
    .select(
      "confirmation_enabled,confirmation_subject,confirmation_body,reminder_enabled,reminder_subject,reminder_body"
    )
    .eq("shelter_id", context.shelter.id)
    .single();

  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    confirmation_enabled,
    confirmation_subject,
    confirmation_body,
    reminder_enabled,
    reminder_subject,
    reminder_body,
  } = body as Record<string, unknown>;

  if (confirmation_enabled) {
    if (!String(confirmation_subject ?? "").trim()) {
      return NextResponse.json({ error: "Bekræftelse: emne må ikke være tomt" }, { status: 400 });
    }
    if (!String(confirmation_body ?? "").trim()) {
      return NextResponse.json({ error: "Bekræftelse: besked må ikke være tom" }, { status: 400 });
    }
  }
  if (String(confirmation_subject ?? "").length > 200) {
    return NextResponse.json({ error: "Bekræftelse: emne må max være 200 tegn" }, { status: 400 });
  }
  if (String(confirmation_body ?? "").length > 2000) {
    return NextResponse.json({ error: "Bekræftelse: besked må max være 2000 tegn" }, { status: 400 });
  }

  if (reminder_enabled) {
    if (!String(reminder_subject ?? "").trim()) {
      return NextResponse.json({ error: "Påmindelse: emne må ikke være tomt" }, { status: 400 });
    }
    if (!String(reminder_body ?? "").trim()) {
      return NextResponse.json({ error: "Påmindelse: besked må ikke være tom" }, { status: 400 });
    }
  }
  if (String(reminder_subject ?? "").length > 200) {
    return NextResponse.json({ error: "Påmindelse: emne må max være 200 tegn" }, { status: 400 });
  }
  if (String(reminder_body ?? "").length > 2000) {
    return NextResponse.json({ error: "Påmindelse: besked må max være 2000 tegn" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("booking_message_templates")
    .upsert(
      {
        shelter_id: context.shelter.id,
        confirmation_enabled: !!confirmation_enabled,
        confirmation_subject: String(confirmation_subject ?? ""),
        confirmation_body: String(confirmation_body ?? ""),
        reminder_enabled: !!reminder_enabled,
        reminder_subject: String(reminder_subject ?? ""),
        reminder_body: String(reminder_body ?? ""),
      },
      { onConflict: "shelter_id" }
    );

  if (error) {
    console.error("ejer messages PATCH error:", error);
    return NextResponse.json({ error: "Kunne ikke gemme" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
