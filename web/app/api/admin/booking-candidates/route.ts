import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { Shelter, ShelterBookingProvider } from "@/types/shelter";
import {
  analyzeBookingCandidate,
  buildBookingCandidateExcerpt,
  inferManualBookingUpdate,
  mergeBookingCandidateReviews,
  stripBookingCandidateHtml,
  sortBookingCandidates,
  type BookingCandidateReviewRow,
  type BookingCandidateReviewStatus,
} from "@/lib/booking-candidates";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 20;
const REVIEWABLE_STATUSES = new Set<BookingCandidateReviewStatus>([
  "booking_found",
  "contact_only",
  "not_bookable",
  "needs_manual",
]);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

function parseStatus(value: string | null): BookingCandidateReviewStatus | "pending" | "all" {
  if (!value) return "pending";
  if (value === "pending" || value === "all") return value;
  return REVIEWABLE_STATUSES.has(value as BookingCandidateReviewStatus)
    ? (value as BookingCandidateReviewStatus)
    : "pending";
}

function normalizeNotes(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProvider(value: unknown): ShelterBookingProvider | null {
  const provider = typeof value === "string" ? value.trim() : "";
  if (!provider) return null;
  return ["shelterdk", "naturstyrelsen", "udinaturen", "kommune", "private", "unknown"].includes(provider)
    ? (provider as ShelterBookingProvider)
    : null;
}

async function listRawShelters(): Promise<Shelter[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shelters")
    .select("id, title, slug, description, booking_url, booking_link_mode, booking_provider, booking_confidence, booking_lookup_key, booking_url_verified_at, kommune, region, bookable_shelters(id)")
    .is("duplicate_of_shelter_id", null)
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Shelter[];
}

async function listReviews(): Promise<BookingCandidateReviewRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shelter_booking_reviews")
    .select("shelter_id, status, notes, reviewed_booking_url, reviewed_at");
  if (error) throw error;
  return (data ?? []) as BookingCandidateReviewRow[];
}

function filterCandidates(
  candidates: ReturnType<typeof mergeBookingCandidateReviews>,
  status: BookingCandidateReviewStatus | "pending" | "all"
) {
  if (status === "all") return candidates;
  if (status === "pending") return candidates.filter((candidate) => !candidate.review);
  return candidates.filter((candidate) => candidate.review?.status === status);
}

function createReviewedCandidate(
  shelter: Shelter,
  review: BookingCandidateReviewRow
) {
  const text = stripBookingCandidateHtml(shelter.description ?? "");
  const foundBookingUrls = review.reviewed_booking_url ? [review.reviewed_booking_url] : [];
  return {
    shelter,
    score: -1,
    likelyBookable: review.status !== "not_bookable",
    suggestedBookingUrl: review.reviewed_booking_url,
    foundBookingUrls,
    positiveSignals: foundBookingUrls.length > 0 ? ["reviewet bookinglink"] : [],
    negativeSignals: review.status === "not_bookable" ? ["markeret ikke bookbar"] : [],
    excerpt: buildBookingCandidateExcerpt(text, foundBookingUrls),
    review,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
  const status = parseStatus(url.searchParams.get("status"));

  try {
    const [shelters, reviews] = await Promise.all([listRawShelters(), listReviews()]);
    const sheltersById = new Map(shelters.map((shelter) => [shelter.id, shelter]));
    const candidates = shelters
      .map((shelter) => analyzeBookingCandidate(shelter))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const reviewedOnly = reviews
      .filter((review) => !candidates.some((candidate) => candidate.shelter.id === review.shelter_id))
      .map((review) => {
        const shelter = sheltersById.get(review.shelter_id);
        return shelter ? createReviewedCandidate(shelter, review) : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

    const merged = sortBookingCandidates([
      ...mergeBookingCandidateReviews(candidates, reviews),
      ...reviewedOnly,
    ]);
    const filtered = filterCandidates(merged, status);
    const from = (page - 1) * pageSize;
    const items = filtered.slice(from, from + pageSize);

    const counts = {
      total: merged.length,
      pending: merged.filter((candidate) => !candidate.review).length,
      booking_found: merged.filter((candidate) => candidate.review?.status === "booking_found").length,
      contact_only: merged.filter((candidate) => candidate.review?.status === "contact_only").length,
      not_bookable: merged.filter((candidate) => candidate.review?.status === "not_bookable").length,
      needs_manual: merged.filter((candidate) => candidate.review?.status === "needs_manual").length,
    };

    return NextResponse.json({
      items,
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      counts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunne ikke hente bookingkandidater" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shelterId = typeof body.shelterId === "string" ? body.shelterId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const notes = normalizeNotes(body.notes);

  if (!shelterId || !action) {
    return NextResponse.json({ error: "shelterId og action er påkrævet" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "save_booking_url") {
    const rawUrl = typeof body.bookingUrl === "string" ? body.bookingUrl.trim() : "";
    if (!rawUrl) {
      return NextResponse.json({ error: "bookingUrl er påkrævet" }, { status: 400 });
    }
    try {
      new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "bookingUrl skal være en gyldig http(s)-URL" }, { status: 400 });
    }

    const update = inferManualBookingUpdate({
      bookingUrl: rawUrl,
      provider: normalizeProvider(body.provider),
      notes,
    });

    const { error: shelterError } = await admin
      .from("shelters")
      .update(update)
      .eq("id", shelterId);

    if (shelterError) {
      return NextResponse.json({ error: shelterError.message }, { status: 400 });
    }

    const { error: reviewError } = await admin
      .from("shelter_booking_reviews")
      .upsert({
        shelter_id: shelterId,
        status: "booking_found",
        notes,
        reviewed_booking_url: rawUrl,
        reviewed_at: new Date().toISOString(),
      });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "mark_contact_only") {
    const update = inferManualBookingUpdate({
      bookingUrl: null,
      provider: normalizeProvider(body.provider) ?? "private",
      notes,
    });

    const { error: shelterError } = await admin
      .from("shelters")
      .update(update)
      .eq("id", shelterId);

    if (shelterError) {
      return NextResponse.json({ error: shelterError.message }, { status: 400 });
    }

    const { error: reviewError } = await admin
      .from("shelter_booking_reviews")
      .upsert({
        shelter_id: shelterId,
        status: "contact_only",
        notes,
        reviewed_booking_url: null,
        reviewed_at: new Date().toISOString(),
      });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "mark_not_bookable" || action === "mark_needs_manual") {
    const status = action === "mark_not_bookable" ? "not_bookable" : "needs_manual";
    const { error } = await admin
      .from("shelter_booking_reviews")
      .upsert({
        shelter_id: shelterId,
        status,
        notes,
        reviewed_booking_url: null,
        reviewed_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ukendt action" }, { status: 400 });
}
