import { createServerClient } from "@supabase/ssr";
import { findActiveRedirect } from "@/lib/custom-redirect-lookup";
import { regionSlugRedirect } from "@/lib/region-slug-redirect";
import { NextResponse, type NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Region-slug-kanonisering (301) — kør før alt andet.
  const regionTarget = regionSlugRedirect(pathname);
  if (regionTarget && regionTarget !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = regionTarget;
    return NextResponse.redirect(url, 301);
  }

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

  // Refresh session — keeps session alive and rotates tokens
  const { data: { user } } = await supabase.auth.getUser();

  const isPublicEjerRoute =
    pathname.startsWith("/ejer/login") ||
    pathname.startsWith("/ejer/signup") ||
    pathname.startsWith("/ejer/glemt-adgangskode") ||
    pathname.startsWith("/ejer/nulstil-adgangskode");

  if (pathname.startsWith("/ejer") && !isPublicEjerRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ejer/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};
