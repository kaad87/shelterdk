import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { Shelter } from "@/types/shelter";
import {
  analyzeOutreachCandidate,
  mergeOutreachReviews,
  sortOutreachCandidates,
  type OutreachReviewRow,
  type OutreachReviewStatus,
} from "@/lib/outreach-candidates";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 20;
const TERMINAL_STATUSES = new Set<OutreachReviewStatus>(["sent", "replied", "not_relevant", "needs_research"]);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

function parseStatus(value: string | null): OutreachReviewStatus | "pending" | "all" {
  if (!value) return "pending";
  if (value === "pending" || value === "all") return value;
  return TERMINAL_STATUSES.has(value as OutreachReviewStatus)
    ? (value as OutreachReviewStatus)
    : "pending";
}

async function listShelters(): Promise<Shelter[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shelters")
    .select("id, title, slug, description, booking_url, booking_link_mode, booking_provider, kommune, region, place, bookable_shelters(id)")
    .is("duplicate_of_shelter_id", null)
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Shelter[];
}

async function listReviews(): Promise<OutreachReviewRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("outreach_review")
    .select("*");
  if (error) throw error;
  return (data ?? []) as OutreachReviewRow[];
}

function filterByStatus(
  candidates: ReturnType<typeof mergeOutreachReviews>,
  status: OutreachReviewStatus | "pending" | "all"
) {
  if (status === "all") return candidates;
  if (status === "pending") return candidates.filter((c) => !c.review);
  return candidates.filter((c) => c.review?.status === status);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT)
  );
  const status = parseStatus(url.searchParams.get("status"));

  try {
    const [shelters, reviews] = await Promise.all([listShelters(), listReviews()]);
    const candidates = shelters
      .map((shelter) => analyzeOutreachCandidate(shelter))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const merged = sortOutreachCandidates(mergeOutreachReviews(candidates, reviews));
    const filtered = filterByStatus(merged, status);
    const from = (page - 1) * pageSize;
    const items = filtered.slice(from, from + pageSize);

    const counts = {
      total: merged.length,
      pending: merged.filter((c) => !c.review).length,
      sent: merged.filter((c) => c.review?.status === "sent").length,
      replied: merged.filter((c) => c.review?.status === "replied").length,
      not_relevant: merged.filter((c) => c.review?.status === "not_relevant").length,
      needs_research: merged.filter((c) => c.review?.status === "needs_research").length,
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
      { error: error instanceof Error ? error.message : "Kunne ikke hente outreach-kandidater" },
      { status: 500 }
    );
  }
}
