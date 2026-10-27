/**
 * Skriver JSON-listen af stier, som fase 1 og 2 aendrer, til stdout.
 * Bruges af revalider-fase1-2.sh. Guide-slugs hentes fra basen, saa listen
 * ikke skal vedligeholdes i haanden, naar en guide udgives.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const FASTE = [
  "/",
  "/bedste",
  "/tilbud",
  "/black-friday",
  "/julegaver",
  "/annoncer-og-partnere",
  "/koeb-shelter",
  "/blog",
  "/guides",
  "/llms.txt",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Mangler Supabase-env");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.from("buying_guides").select("slug").eq("status", "published");
  if (error) throw new Error(`buying_guides: ${error.message}`);
  const guider = (data ?? []).map((g) => `/bedste/${g.slug}`);
  process.stdout.write(JSON.stringify([...FASTE, ...guider]));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
