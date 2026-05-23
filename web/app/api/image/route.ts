import { NextResponse } from "next/server";
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
    // Hold proxiede tredjepartsbilleder private indtil vi er helt sikre på,
    // at upstream/CDN cache-nøglen respekterer hele querystringen per unik
    // `url=`. Ellers kan forskellige shelters ende med at dele samme billede.
    "Cache-Control": "private, max-age=604800, stale-while-revalidate=2592000",
  };
}

function passthroughResponse(buf: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: cacheHeaders(contentType),
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url");
  if (!raw) return errorResponse(400, "Missing url");
  const w = searchParams.get("w");
  const h = searchParams.get("h");
  const qRaw = searchParams.get("q");
  const width = w ? Math.min(MAX_WIDTH, Math.max(MIN_DIM, parseInt(w, 10) || 0)) : null;
  const height = h ? Math.min(MAX_HEIGHT, Math.max(MIN_DIM, parseInt(h, 10) || 0)) : null;
  const quality = qRaw ? Math.max(1, Math.min(100, parseInt(qRaw, 10) || 82)) : 82;

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

  // GIFs: passthrough to preserve animation
  if (contentType.toLowerCase().includes("gif")) {
    return passthroughResponse(buf, contentType);
  }

  // Try sharp for resizing/optimization, fall back to passthrough
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buf, { failOnError: false }).rotate();
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

    const format = (meta.format || "").toLowerCase();
    let out: Buffer;
    if (format === "png") {
      out = await resized.png().toBuffer();
    } else if (format === "webp") {
      out = await resized.webp({ quality }).toBuffer();
    } else {
      out = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
    }

    const outType =
      format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: cacheHeaders(outType),
    });
  } catch {
    // sharp unavailable or failed — passthrough the original image
    return passthroughResponse(buf, contentType);
  }
}
