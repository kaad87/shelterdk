import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAllowedImageHosts } from "@/lib/image-proxy";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const FETCH_TIMEOUT_MS = 12_000;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const MIN_DIM = 32;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function cacheHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    // private: kun browser-cache, ikke CDN – undgår at Netlify returnerer samme
    // cachede svar for alle /api/image?url=... requests uanset query param.
    "Cache-Control": "private, max-age=604800, stale-while-revalidate=2592000",
  };
}

function pickOutputContentType(format: string | undefined | null): string {
  switch ((format || "").toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "jpeg":
    case "jpg":
    default:
      return "image/jpeg";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url");
  if (!raw) return errorResponse(400, "Missing url");
  const w = searchParams.get("w");
  const h = searchParams.get("h");
  const width = w ? Math.min(MAX_WIDTH, Math.max(MIN_DIM, parseInt(w, 10) || 0)) : null;
  const height = h ? Math.min(MAX_HEIGHT, Math.max(MIN_DIM, parseInt(h, 10) || 0)) : null;

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return errorResponse(400, "Invalid url");
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return errorResponse(400, "Invalid protocol");
  }

  const allowedHosts = getAllowedImageHosts();
  if (!allowedHosts.has(target.hostname)) {
    return errorResponse(403, "Host not allowed");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        // Some hosts vary by Accept; keep it explicit.
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });
  } catch {
    clearTimeout(timeout);
    return errorResponse(502, "Fetch failed");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return errorResponse(502, `Upstream error (${res.status})`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return errorResponse(415, "Not an image");
  }

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    return errorResponse(413, "Image too large");
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return errorResponse(413, "Image too large");

  // Animated GIFs: sharp will only process the first frame unless configured.
  // For safety, passthrough.
  if (contentType.toLowerCase().includes("gif")) {
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: cacheHeaders(contentType),
    });
  }

  try {
    const img = sharp(buf, { failOnError: false }).rotate(); // rotate() respects EXIF orientation
    const meta = await img.metadata();
    const resized =
      width || height
        ? img.resize({
            width: width || undefined,
            height: height || undefined,
            fit: "inside",
            withoutEnlargement: true,
          })
        : img;

    const outputType = pickOutputContentType(meta.format);
    const out = await (outputType === "image/png"
      ? resized.png().toBuffer()
      : outputType === "image/webp"
        ? resized.webp({ quality: 82 }).toBuffer()
        : outputType === "image/avif"
          ? resized.avif({ quality: 55 }).toBuffer()
          : resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer());

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: cacheHeaders(outputType),
    });
  } catch {
    // If sharp fails for any reason, fallback to passthrough.
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: cacheHeaders(contentType),
    });
  }
}

