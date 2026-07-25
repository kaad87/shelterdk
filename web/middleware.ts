import { createServerClient } from "@supabase/ssr";
import { findActiveRedirect } from "@/lib/custom-redirect-lookup";
import { NextResponse, type NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // BEMÆRK: region-slug-kanoniseringen er flyttet til next.config.js `redirects()`,
  // og matcheren nedenfor er snævret ind til /ejer/* + /book*. Offentlige content-
  // sider matches IKKE længere af middleware → de kan ISR/CDN-caches (før kørte de
  // gennem edge-funktionen pr. request = no-store/egress).

  const skipRedirectLookup =
    pathname.startsWith("/ejer/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/");

  if (!skipRedirectLookup) {
    const redirectRule = await findActiveRedirect(pathname);
    if (redirectRule) {
      const destination = new URL(redirectRule.destination_url, request.url);
      request.nextUrl.searchParams.forEach((value, key) => {
        if (!destination.searchParams.has(key)) {
          destination.searchParams.set(key, value);
        }
      });
      return NextResponse.redirect(destination, redirectRule.status_code);
    }
  }

  const isPublicEjerRoute =
    pathname.startsWith("/ejer/login") ||
    pathname.startsWith("/ejer/signup") ||
    pathname.startsWith("/ejer/glemt-adgangskode") ||
    pathname.startsWith("/ejer/nulstil-adgangskode");
  const needsAuthGate = pathname.startsWith("/ejer") && !isPublicEjerRoute;

  // Anonyme besøgende har ingen Supabase-session-cookie → der er hverken en session
  // at forny eller en adgangsspærre at håndhæve. Vi springer derfor hele auth-kaldet
  // over for dem. Det er langt størstedelen af trafikken (inkl. crawlere) og fjerner
  // et per-request Auth-round-trip, der timede edge-funktionen ud under egress-throttlingen.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) {
    if (needsAuthGate) {
      const url = request.nextUrl.clone();
      url.pathname = "/ejer/login";
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  // Create a Supabase client that can refresh session cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — keeps session alive and rotates tokens (only for logged-in owners)
  const { data: { user } } = await supabase.auth.getUser();

  if (needsAuthGate && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ejer/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Kun de ruter der reelt kræver per-request-logik. Alt andet (shelter, by,
  // omraade, region, filtre, guides, blog, forside …) undgår middleware og kan
  // dermed serveres fra Netlifys durable/CDN-cache.
  //   /ejer/*  → owner-auth-gate + session-refresh
  //   /bookN   → QR-vanity-redirects via findActiveRedirect (runtime-editérbare)
  matcher: ["/ejer/:path*", "/book:id(\\d+)"],
};
