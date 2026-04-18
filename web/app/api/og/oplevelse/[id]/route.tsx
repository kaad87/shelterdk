import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { truncate } from "@/lib/experiences";

export const runtime = "edge";

// Inter font must be bundled — place Inter-Regular.ttf in web/public/fonts/
async function loadFont(origin: string) {
  const res = await fetch(`${origin}/fonts/Inter-Regular.ttf`);
  return res.arrayBuffer();
}

/**
 * GET /api/og/oplevelse/[id]
 *
 * Generates a 1200×630 share card for a shelter experience.
 * Renders for both 'pending' and 'approved' statuses so users can
 * share immediately after submission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const origin = new URL(request.url).origin;
  const { id } = params;

  // Fetch experience + shelter name (service role to see pending)
  const supabase = createAdminClient();
  const { data: exp, error } = await supabase
    .from("shelter_experiences")
    .select("id, author_name, body, photo_urls, cover_photo_index, created_at, status, shelter:shelters(title, region)")
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .single();

  if (error || !exp) {
    return new Response("Not found", { status: 404 });
  }

  const shelterTitle = (exp.shelter as { title: string; region: string } | null)?.title ?? "Shelter";
  const region = (exp.shelter as { title: string; region: string } | null)?.region ?? "";
  const coverUrl = exp.photo_urls?.[exp.cover_photo_index] ?? null;
  const extraPhotos = exp.photo_urls.length - 1;
  const bodyText = truncate(exp.body, 100);
  const date = new Date(exp.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });

  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await loadFont(origin);
  } catch {
    // Fallback: render without custom font
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          background: "#1a2e1a",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Background photo */}
        {coverUrl && (
          <img
            src={coverUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.88) 100%)",
            display: "flex",
          }}
        />

        {/* +N badge */}
        {extraPhotos > 0 && (
          <div
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              background: "rgba(0,0,0,0.55)",
              borderRadius: "20px",
              padding: "6px 16px",
              color: "white",
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
            }}
          >
            +{extraPhotos} billeder
          </div>
        )}

        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "48px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Location */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.75)", fontSize: "20px" }}>
            <span>📍</span>
            <span>{shelterTitle}{region ? `, ${region}` : ""}</span>
          </div>

          {/* Quote */}
          <div style={{ color: "white", fontSize: "28px", fontStyle: "italic", lineHeight: 1.4, display: "flex" }}>
            &ldquo;{bodyText}&rdquo;
          </div>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px", display: "flex" }}>
              {exp.author_name} · {date}
            </div>
            <div
              style={{
                background: "#2d7a4e",
                borderRadius: "6px",
                padding: "8px 18px",
                color: "white",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                display: "flex",
              }}
            >
              shelterdk.dk
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, style: "normal", weight: 400 }]
        : [],
    }
  );
}
