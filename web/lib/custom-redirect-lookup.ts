import { createClient } from "@supabase/supabase-js";
import { normalizeRedirectSourcePath } from "@/lib/custom-redirect-utils";

export async function findActiveRedirect(sourcePath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const source = normalizeRedirectSourcePath(sourcePath);
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("custom_redirects")
    .select("destination_url,status_code")
    .eq("source_path", source)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("custom redirect lookup failed:", error);
    return null;
  }

  if (!data) return null;
  return data as { destination_url: string; status_code: 301 | 302 | 307 | 308 };
}
