import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Matcher præcis isShelterPlace() i lib/shelter-detail.ts:
 *   return placeName.toLowerCase().trim().includes("shelter");
 *
 * Kun shelters hvor Google Place-navnet indeholder "shelter" viser
 * rating-badget på kortet. Sortering skal matche dette 1:1.
 */
function isShelterPlace(placeName: string | null): boolean {
  if (!placeName || typeof placeName !== 'string') return false;
  return placeName.toLowerCase().trim().includes('shelter');
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const PAGE = 500;
  let all: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('shelters')
      .select('id, slug, title, google_place_id, google_place_name, google_user_ratings_total, google_rating, geofa_raw')
      .not('google_place_id', 'is', null)
      .not('google_user_ratings_total', 'is', null)
      .gt('google_user_ratings_total', 0)
      .range(offset, offset + PAGE - 1)
      .limit(PAGE);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Total shelters med Google Place reviews: ${all.length}`);

  const toFix = all.filter(s => !isShelterPlace(s.google_place_name));
  const alreadyFixed = toFix.filter(s => s.geofa_raw?.google_place_mismatch === true);
  const needsFix = toFix.filter(s => s.geofa_raw?.google_place_mismatch !== true);

  console.log(`google_place_name indeholder "shelter": ${all.length - toFix.length} (beholdes)`);
  console.log(`google_place_name UDEN "shelter": ${toFix.length}`);
  console.log(`  → Allerede fixed (v1): ${alreadyFixed.length}`);
  console.log(`  → Ny fix: ${needsFix.length}`);

  // Vis nye som skal fixes
  needsFix.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));

  console.log('\n' + '='.repeat(100));
  console.log(`NYE SHELTERS DER SKAL FIXES (${needsFix.length})`);
  console.log('='.repeat(100));
  for (const s of needsFix.slice(0, 40)) {
    console.log(
      String(s.google_user_ratings_total).padEnd(8),
      (s.google_place_name || '').substring(0, 42).padEnd(44),
      (s.title || '').substring(0, 45)
    );
  }
  if (needsFix.length > 40) console.log(`  ... og ${needsFix.length - 40} mere`);

  // Vis korrekte (beholdes)
  const kept = all.filter(s => isShelterPlace(s.google_place_name));
  kept.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));
  console.log('\n' + '='.repeat(100));
  console.log(`TOP 15 BEHOLDTE (google_place_name indeholder "shelter")`);
  console.log('='.repeat(100));
  for (const s of kept.slice(0, 15)) {
    console.log(
      String(s.google_user_ratings_total).padEnd(8),
      (s.google_place_name || '').substring(0, 42).padEnd(44),
      (s.title || '').substring(0, 45)
    );
  }

  if (DRY_RUN) {
    console.log(`\n🔶 DRY RUN — ville have nulstillet ${needsFix.length} shelters (${alreadyFixed.length} allerede fixed).`);
    return;
  }

  console.log(`\n📝 Nulstiller ${needsFix.length} shelters...`);
  let updated = 0;
  let errors = 0;

  for (const s of needsFix) {
    const currentRaw = (s.geofa_raw && typeof s.geofa_raw === 'object') ? s.geofa_raw : {};
    const newRaw = {
      ...currentRaw,
      google_place_mismatch: true,
      original_google_rating: currentRaw.original_google_rating ?? s.google_rating,
      original_google_user_ratings_total: currentRaw.original_google_user_ratings_total ?? s.google_user_ratings_total,
    };

    const { error } = await supabase
      .from('shelters')
      .update({
        geofa_raw: newRaw,
        google_rating: null,
        google_user_ratings_total: null,
      })
      .eq('id', s.id);

    if (error) {
      console.error(`  ✗ ${s.title}: ${error.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\n✅ Opdateret: ${updated}`);
  if (errors) console.log(`❌ Fejl: ${errors}`);
}

main().catch(console.error);
