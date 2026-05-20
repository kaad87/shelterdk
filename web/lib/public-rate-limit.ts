import { createHash } from "crypto";
import { createAdminClient } from "@/utils/supabase/server-admin";

type RateLimitOptions = {
  scope: string;
  windowSeconds: number;
  maxHits: number;
  errorMessage: string;
};

type RateLimitRow = {
  allowed: boolean;
  hits: number;
  retry_after_seconds: number;
};

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function hashRateLimitSubject(subject: string): string {
  return createHash("sha256").update(subject).digest("hex");
}

export async function enforcePublicRateLimit(
  request: Request,
  opts: RateLimitOptions
): Promise<Response | null> {
  const subjectHash = hashRateLimitSubject(
    `${opts.scope}:${getClientIp(request)}`
  );

  const { data, error } = await createAdminClient().rpc(
    "consume_public_rate_limit",
    {
      p_scope: opts.scope,
      p_subject_hash: subjectHash,
      p_window_seconds: opts.windowSeconds,
      p_max_hits: opts.maxHits,
    }
  );

  if (error) {
    console.error("public rate limit error:", error);
    return Response.json(
      { error: "Sikkerhedstjekket kunne ikke gennemføres. Prøv igen om lidt." },
      { status: 503 }
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row) {
    return Response.json(
      { error: "Sikkerhedstjekket kunne ikke gennemføres. Prøv igen om lidt." },
      { status: 503 }
    );
  }

  if (!row.allowed) {
    return Response.json(
      { error: opts.errorMessage },
      {
        status: 429,
        headers: {
          "Retry-After": String(row.retry_after_seconds),
        },
      }
    );
  }

  return null;
}
