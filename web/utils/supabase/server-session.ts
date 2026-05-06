import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Supabase client that reads and writes session cookies.
 * Use in API routes and Server Components under /ejer/*.
 * Uses the anon key — permissions come from Supabase Auth session, not service_role.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Thrown in read-only Server Component render contexts.
            // Safe to ignore — the middleware refreshes the session cookie.
          }
        },
      },
    }
  );
}

/**
 * Get the currently authenticated user from session cookies.
 * Returns null if not logged in.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}
