import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getAuthenticatedOwnerGroupContext } from "@/lib/ejer-auth";

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

function serializeTemplate(row: {
  confirmation_enabled: boolean;
  confirmation_subject: string;
  confirmation_body: string;
  reminder_enabled: boolean;
  reminder_subject: string;
  reminder_body: string;
}) {
  return JSON.stringify([
    row.confirmation_enabled,
    row.confirmation_subject,
    row.confirmation_body,
    row.reminder_enabled,
    row.reminder_subject,
    row.reminder_body,
  ]);
}

function deserializeTemplate(serialized: string) {
  const [
    confirmation_enabled,
    confirmation_subject,
    confirmation_body,
    reminder_enabled,
    reminder_subject,
    reminder_body,
  ] = JSON.parse(serialized) as [
    boolean,
    string,
    string,
    boolean,
    string,
    string,
  ];

  return {
    confirmation_enabled,
    confirmation_subject,
    confirmation_body,
    reminder_enabled,
    reminder_subject,
    reminder_body,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const context = await getAuthenticatedOwnerGroupContext(groupId);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const unitIds = context.shelters.map((s) => s.id);
  const { data } = await createAdminClient()
    .from("booking_message_templates")
    .select(
      "shelter_id,confirmation_enabled,confirmation_subject,confirmation_body,reminder_enabled,reminder_subject,reminder_body"
    )
    .in("shelter_id", unitIds);

  const byShelterId = new Map((data ?? []).map((row) => [row.shelter_id, row]));
  const serializedTemplates = context.shelters.map((shelter) =>
    serializeTemplate(
      byShelterId.get(shelter.id)
        ? {
            confirmation_enabled: !!byShelterId.get(shelter.id)?.confirmation_enabled,
            confirmation_subject: String(byShelterId.get(shelter.id)?.confirmation_subject ?? ""),
            confirmation_body: String(byShelterId.get(shelter.id)?.confirmation_body ?? ""),
            reminder_enabled: !!byShelterId.get(shelter.id)?.reminder_enabled,
            reminder_subject: String(byShelterId.get(shelter.id)?.reminder_subject ?? ""),
            reminder_body: String(byShelterId.get(shelter.id)?.reminder_body ?? ""),
          }
        : DEFAULTS
    )
  );
  const distinctTemplates = new Set(serializedTemplates);
  const frequency = new Map<string, number>();
  for (const serialized of serializedTemplates) {
    frequency.set(serialized, (frequency.get(serialized) ?? 0) + 1);
  }
  const preferredSerialized =
    serializedTemplates.reduce((best, current) => {
      if (!best) return current;
      return (frequency.get(current) ?? 0) > (frequency.get(best) ?? 0) ? current : best;
    }, serializedTemplates[0]) ?? serializeTemplate(DEFAULTS);
  const preferred = deserializeTemplate(preferredSerialized);

  return NextResponse.json(
    {
      confirmation_enabled: preferred.confirmation_enabled,
      confirmation_subject: preferred.confirmation_subject,
      confirmation_body: preferred.confirmation_body,
      reminder_enabled: preferred.reminder_enabled,
      reminder_subject: preferred.reminder_subject,
      reminder_body: preferred.reminder_body,
      hasDivergentTemplates: distinctTemplates.size > 1,
    }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const context = await getAuthenticatedOwnerGroupContext(groupId);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    confirmation_enabled,
    confirmation_subject,
    confirmation_body,
    reminder_enabled,
    reminder_subject,
    reminder_body,
    force_replace_all,
  } = body as Record<string, unknown>;

  if (confirmation_enabled) {
    if (!String(confirmation_subject ?? "").trim()) {
      return NextResponse.json({ error: "Bekræftelse: emne må ikke være tomt" }, { status: 400 });
    }
    if (!String(confirmation_body ?? "").trim()) {
      return NextResponse.json({ error: "Bekræftelse: besked må ikke være tomt" }, { status: 400 });
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
      return NextResponse.json({ error: "Påmindelse: besked må ikke være tomt" }, { status: 400 });
    }
  }
  if (String(reminder_subject ?? "").length > 200) {
    return NextResponse.json({ error: "Påmindelse: emne må max være 200 tegn" }, { status: 400 });
  }
  if (String(reminder_body ?? "").length > 2000) {
    return NextResponse.json({ error: "Påmindelse: besked må max være 2000 tegn" }, { status: 400 });
  }

  const { data: existingData } = await createAdminClient()
    .from("booking_message_templates")
    .select(
      "shelter_id,confirmation_enabled,confirmation_subject,confirmation_body,reminder_enabled,reminder_subject,reminder_body"
    )
    .in("shelter_id", context.shelters.map((shelter) => shelter.id));

  const existingByShelterId = new Map((existingData ?? []).map((row) => [row.shelter_id, row]));
  const distinctExistingTemplates = new Set(
    context.shelters.map((shelter) =>
      serializeTemplate(
        existingByShelterId.get(shelter.id)
          ? {
              confirmation_enabled: !!existingByShelterId.get(shelter.id)?.confirmation_enabled,
              confirmation_subject: String(existingByShelterId.get(shelter.id)?.confirmation_subject ?? ""),
              confirmation_body: String(existingByShelterId.get(shelter.id)?.confirmation_body ?? ""),
              reminder_enabled: !!existingByShelterId.get(shelter.id)?.reminder_enabled,
              reminder_subject: String(existingByShelterId.get(shelter.id)?.reminder_subject ?? ""),
              reminder_body: String(existingByShelterId.get(shelter.id)?.reminder_body ?? ""),
            }
          : DEFAULTS
      )
    )
  );

  if (distinctExistingTemplates.size > 1 && force_replace_all !== true) {
    return NextResponse.json(
      {
        error:
          "Skabelonerne er ikke ens på tværs af shelters endnu. Gem igen for at erstatte alle med den viste fælles version.",
        code: "templates_diverge",
      },
      { status: 409 }
    );
  }

  const unitRows = context.shelters.map((shelter) => ({
    shelter_id: shelter.id,
    confirmation_enabled: !!confirmation_enabled,
    confirmation_subject: String(confirmation_subject ?? ""),
    confirmation_body: String(confirmation_body ?? ""),
    reminder_enabled: !!reminder_enabled,
    reminder_subject: String(reminder_subject ?? ""),
    reminder_body: String(reminder_body ?? ""),
  }));

  const { error } = await createAdminClient()
    .from("booking_message_templates")
    .upsert(unitRows, { onConflict: "shelter_id" });

  if (error) {
    console.error("group messages PATCH error:", error);
    return NextResponse.json({ error: "Kunne ikke gemme" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedCount: unitRows.length });
}
