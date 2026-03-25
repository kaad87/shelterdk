import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-klient med service_role nøgle til server-side write operationer.
 * Bruges KUN i API routes der kræver write-adgang (admin, submit, upload).
 * Service_role nøglen bypasser RLS — brug den ALDRIG i browser-kode.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local"
    );
  }

  return createClient(url, key);
}
