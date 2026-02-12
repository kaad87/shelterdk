import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-klient til server-side læsning af public data (shelters, google_places m.m.).
 * Kræver NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local (i web/) eller miljø.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY. Opret web/.env.local med værdier fra shelterdk/.env"
    );
  }

  return createClient(url, key);
}
