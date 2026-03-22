import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Shelter-relaterede nøgleord i Google Place-navnet.
 * Hvis Google Place-navnet indeholder et af disse, er anmeldelserne relevante for shelteret.
 */
const SHELTER_PLACE_KEYWORDS = [
  'shelter', 'shelterplads', 'shelterpladser', 'sheltere',
  'overnatning', 'overnatningsplads',
  'primitiv', 'teltplads', 'lejrplads', 'naturlejrplads',
  'bivuak', 'madpakkehus', 'bålhytte', 'skovhytte',
  'naturbase', 'naturrum', 'friluftsgård',
  'camping', 'campingplads',
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zæøå0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function googlePlaceIsShelterSpecific(googlePlaceName: string): boolean {
  const n = normalize(googlePlaceName);
  return SHELTER_PLACE_KEYWORDS.some(kw => n.includes(kw));
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
      .gt('google_user_ratings_total', 0)
      .range(offset, offset + PAGE - 1)
      .limit(PAGE);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`\nTotal shelters with Google Place reviews: ${all.length}`);

  // Categorize: shelter-specific vs not
  const nonShelterPlaces = all.filter(s => !googlePlaceIsShelterSpecific(s.google_place_name || ''));
  const shelterPlaces = all.filter(s => googlePlaceIsShelterSpecific(s.google_place_name || ''));

  // Only clear reviews for places with > THRESHOLD reviews where Google Place isn't shelter-specific.
  // Small review counts (<= 50) are likely genuine shelter reviews even if the place name is generic.
  const REVIEW_THRESHOLD = 50;
  const toFix = nonShelterPlaces.filter(s => (s.google_user_ratings_total || 0) > REVIEW_THRESHOLD);
  const toKeep = nonShelterPlaces.filter(s => (s.google_user_ratings_total || 0) <= REVIEW_THRESHOLD);

  console.log(`Google Place IS shelter-specific: ${shelterPlaces.length}`);
  console.log(`Google Place is NOT shelter-specific: ${nonShelterPlaces.length}`);
  console.log(`  → Will fix (reviews > ${REVIEW_THRESHOLD}): ${toFix.length}`);
  console.log(`  → Will keep (reviews ≤ ${REVIEW_THRESHOLD}): ${toKeep.length}`);

  // Sort by review count
  toFix.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));

  console.log('\n' + '='.repeat(100));
  console.log(`SHELTERS TO FIX — reviews > ${REVIEW_THRESHOLD}, Google Place is NOT shelter-specific`);
  console.log('(ratings will be nulled, originals saved in geofa_raw)');
  console.log('='.repeat(100));
  console.log(
    'Reviews'.padEnd(9),
    'Rating'.padEnd(7),
    'Google Place Name'.padEnd(45),
    'Shelter Title'
  );
  console.log('-'.repeat(100));

  for (const s of toFix) {
    console.log(
      String(s.google_user_ratings_total).padEnd(9),
      String(s.google_rating?.toFixed(1) || 'N/A').padEnd(7),
      (s.google_place_name || '').substring(0, 43).padEnd(45),
      (s.title || '').substring(0, 45)
    );
  }

  // Confirm shelter-specific ones look correct
  console.log('\n' + '='.repeat(100));
  console.log('TOP 20 SHELTER-SPECIFIC GOOGLE PLACES (should be correct)');
  console.log('='.repeat(100));
  shelterPlaces.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));
  for (const s of shelterPlaces.slice(0, 20)) {
    console.log(
      String(s.google_user_ratings_total).padEnd(9),
      String(s.google_rating?.toFixed(1) || 'N/A').padEnd(7),
      (s.google_place_name || '').substring(0, 43).padEnd(45),
      (s.title || '').substring(0, 45)
    );
  }

  if (DRY_RUN) {
    console.log(`\n🔶 DRY RUN — ville have nulstillet ${toFix.length} shelters (beholdt ${toKeep.length} med ≤ ${REVIEW_THRESHOLD} reviews).`);
    console.log('Kør uden --dry-run for at udføre ændringerne.');
    return;
  }

  // Mark and null out ratings for non-shelter places above threshold
  console.log(`\n📝 Nulstiller ${toFix.length} shelters med misvisende Google reviews...`);
  let updated = 0;
  let errors = 0;

  for (const s of toFix) {
    const currentRaw = (s.geofa_raw && typeof s.geofa_raw === 'object') ? s.geofa_raw : {};
    const newRaw = {
      ...currentRaw,
      google_place_mismatch: true,
      // Gem originale værdier så de kan genskabes
      original_google_rating: s.google_rating,
      original_google_user_ratings_total: s.google_user_ratings_total,
    };

    const { error } = await supabase
      .from('shelters')
      .update({
        geofa_raw: newRaw,
        // Nulstil ratings så de ikke forurener sortering og visning
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
  console.log('\nOriginale værdier gemt i geofa_raw (original_google_rating, original_google_user_ratings_total).');
  console.log('google_rating og google_user_ratings_total er sat til null for disse shelters.');
}

main().catch(console.error);
