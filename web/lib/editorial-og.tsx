import { ImageResponse } from "@vercel/og";

export const OG_SIZE = {
  width: 1200,
  height: 630,
} as const;

export const OG_CONTENT_TYPE = "image/png";

interface EditorialOgOptions {
  eyebrow: string;
  title: string;
  subtitle?: string;
  tag?: string;
}

function trimText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function createEditorialOgImage({
  eyebrow,
  title,
  subtitle,
  tag,
}: EditorialOgOptions) {
  const safeTitle = trimText(title, 90) ?? "ShelterDK";
  const safeSubtitle = trimText(subtitle, 180);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          background:
            "radial-gradient(circle at top left, rgba(212,169,88,0.20), transparent 42%), linear-gradient(135deg, #22364a 0%, #172635 55%, #0f1b28 100%)",
          color: "#f8fafc",
          fontFamily: "Georgia, ui-serif, serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "34px",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "48px",
            left: "56px",
            right: "56px",
            bottom: "48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "24px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(248,250,252,0.72)",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "999px",
                    background: "#d4a958",
                    display: "flex",
                  }}
                />
                <span>{eyebrow}</span>
              </div>
              {tag ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "999px",
                    border: "1px solid rgba(212,169,88,0.40)",
                    background: "rgba(212,169,88,0.12)",
                    padding: "12px 20px",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "#f4d28f",
                  }}
                >
                  {tag}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "980px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "70px",
                  lineHeight: 1.02,
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {safeTitle}
              </div>
              {safeSubtitle ? (
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "30px",
                    lineHeight: 1.35,
                    color: "rgba(248,250,252,0.78)",
                    maxWidth: "920px",
                  }}
                >
                  {safeSubtitle}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                color: "rgba(248,250,252,0.70)",
                fontSize: "26px",
              }}
            >
              <span style={{ color: "#d4a958", fontWeight: 700 }}>SHELTERDK</span>
              <span>Guides, inspiration og naturovernatning</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "999px",
                padding: "12px 22px",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                fontSize: "24px",
                fontWeight: 600,
              }}
            >
              shelterdk.dk
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
