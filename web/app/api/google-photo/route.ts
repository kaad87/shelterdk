/**
 * Proxy for Google Place Photo API.
 * Fetches billede via photo_reference og returnerer det med cache (max 7 dage, inden for Googles 30-dages grænse).
 * Kald: GET /api/google-photo?ref=PHOTO_REFERENCE&maxwidth=1200
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_PHOTO_API = "https://maps.googleapis.com/maps/api/place/photo";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function cacheHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxwidth = Math.min(
    1600,
    Math.max(100, parseInt(searchParams.get("maxwidth") || "1200", 10) || 1200)
  );

  if (!ref || typeof ref !== "string" || ref.length < 10) {
    return errorResponse(400, "Missing or invalid ref");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey?.trim()) {
    return errorResponse(503, "Google API key not configured");
  }

  const url = new URL(GOOGLE_PHOTO_API);
  url.searchParams.set("photo_reference", ref.trim());
  url.searchParams.set("maxwidth", String(maxwidth));
  url.searchParams.set("key", apiKey.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Googles Photo API svarer 302 → lh3.googleusercontent.com. Send browseren
    // direkte derhen i stedet for at streame billed-bytes gennem Netlify
    // (bandwidth-lækage). lh3-URL'en indeholder ikke API-nøglen.
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timeout);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      return new NextResponse(null, {
        status: 302,
        headers: {
          Location: location,
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    }
    // Fallback: Google svarede ikke med redirect — stream som før.
    if (!res.ok) {
      return errorResponse(502, `Google API error (${res.status})`);
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return errorResponse(415, "Not an image");
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return errorResponse(413, "Image too large");
    }
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: cacheHeaders(contentType),
    });
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error)?.name === "AbortError") {
      return errorResponse(504, "Request timeout");
    }
    return errorResponse(502, "Fetch failed");
  }
}
