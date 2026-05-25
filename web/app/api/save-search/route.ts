import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";
import {
  generateSavedSearchToken,
  isValidEmailFormat,
  type SavedSearchRow,
} from "@/lib/saved-searches";
import { sendSavedSearchConfirmation } from "@/lib/saved-search-email";
import type { SoegFilters } from "@/lib/soeg-db";

export const dynamic = "force-dynamic";

const ALLOWED_FILTER_KEYS = new Set<keyof SoegFilters>([
  "anmeldelser",
  "bookbar",
  "vand",
  "toilet",
  "hund",
  "baalplads",
  "gratis",
  "handicap",
  "bord_baenk",
  "strand",
  "bruser",
  "min_pladser",
]);

function sanitizeFilters(raw: unknown): SoegFilters {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: SoegFilters = {};
  for (const key of ALLOWED_FILTER_KEYS) {
    const v = input[key];
    if (typeof v === "boolean" && v) (out as Record<string, boolean>)[key] = true;
    else if (key === "min_pladser" && typeof v === "number" && v > 0 && v <= 100) {
      out.min_pladser = Math.floor(v);
    }
  }
  return out;
}

function clipString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  // Rate limit: max 3 oprettelser per IP per 10 min — beskytter mod
  // abuse uden at irritere normale brugere.
  const limited = await enforcePublicRateLimit(req, {
    scope: "save_search",
    windowSeconds: 600,
    maxHits: 3,
    errorMessage: "Du har gemt for mange søgninger lige nu. Prøv igen om 10 minutter.",
  });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ error: "Ugyldig e-mailadresse" }, { status: 400 });
  }

  const region = clipString(body.region, 60);
  const q = clipString(body.q, 80);
  const area = clipString(body.area, 80);
  const filters = sanitizeFilters(body.filters);

  // Honeypot for primitive bots — UI-formularen sender altid feltet tomt.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }); // act-like-success
  }

  const admin = createAdminClient();

  // Hvis brugeren allerede har en bekræftet søgning der ligner denne, så
  // overskriv vi ikke. Send blot en venlig "du er allerede tilmeldt".
  const { data: existing } = await admin
    .from("saved_searches")
    .select("id, token, confirmed_at, region, q, area, filters")
    .eq("email", email)
    .eq("region", region ?? "")
    .eq("q", q ?? "")
    .eq("area", area ?? "")
    .limit(5);
  if (existing) {
    for (const row of existing as Array<{
      id: string;
      token: string;
      confirmed_at: string | null;
      region: string | null;
      q: string | null;
      area: string | null;
      filters: SoegFilters;
    }>) {
      // Match på filters-JSON via JSON.stringify (rækkefølge-stabil
      // sortering ville være mere robust, men dette er godt nok her).
      if (JSON.stringify(row.filters ?? {}) === JSON.stringify(filters)) {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          confirmed: Boolean(row.confirmed_at),
        });
      }
    }
  }

  const token = generateSavedSearchToken();
  const ipAddress =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { data: inserted, error } = await admin
    .from("saved_searches")
    .insert({
      email,
      region,
      q,
      area,
      filters,
      token,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    console.error("save-search insert failed", error);
    return NextResponse.json({ error: "Kunne ikke gemme søgningen lige nu" }, { status: 500 });
  }

  try {
    await sendSavedSearchConfirmation(inserted as SavedSearchRow);
  } catch (err) {
    console.error("save-search confirmation email failed", err);
    // Vi sletter ikke rækken — brugeren kan altid få re-sendt fra admin.
    return NextResponse.json(
      { error: "Søgningen er gemt, men bekræftelsesmailen kunne ikke sendes. Skriv til os hvis den ikke kommer." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, sentConfirmation: true });
}
