import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Words that indicate the Google Place is likely a shelter/camping
const SHELTER_KEYWORDS = [
  'shelter', 'shelterplads', 'overnatning', 'primitiv', 'lejrplads',
  'bålplads', 'teltplads', 'naturlejrplads', 'skovhytte', 'hytte',
  'bivuak', 'madpakkehus', 'naturbase', 'bålhytte', 'grillplads',
  'campingplads', 'camping', 'naturrum', 'friluftsliv',
];

// Words that indicate a mismatch (clearly different type of place)
const MISMATCH_KEYWORDS = [
  'købmand', 'købmandsgård', 'havn', 'museum', 'kirke', 'restaurant',
  'café', 'cafe', 'hotel', 'kro', 'butik', 'shop', 'skole', 'school',
  'bibliotek', 'stadion', 'svømmehal', 'supermarked', 'tankstation',
  'apotek', 'hospital', 'lægeklinik', 'tandlæge', 'dyrlæge',
  'slot', 'gods', 'herregård', 'galleri', 'teater', 'biograf',
  'bar', 'pub', 'natklub', 'fitnesscenter', 'idræt', 'sportscenter',
  'mekaniker', 'autoværksted', 'frisør', 'ejendomsmægler',
  'møbelforretning', 'tøjbutik', 'slagter', 'bager', 'pizzeria',
  'grill', 'kebab', 'sushi', 'marina', 'færge', 'station',
  'parkering', 'parkeringsplads', 'toilet', 'legeplads',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignificantWords(s: string): Set<string> {
  const stopwords = new Set([
    'i', 'og', 'på', 'ved', 'den', 'det', 'de', 'en', 'et', 'af',
    'til', 'for', 'med', 'the', 'of', 'and', 'in', 'at', 'by', 'to',
    'a', 'an', 'is', 'are', 'was', 'nr', 'st', 'sø', 'å',
  ]);
  const words = normalize(s).split(' ').filter(w => w.length > 1 && !stopwords.has(w));
  return new Set(words);
}

function wordOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const w of a) {
    if (b.has(w)) count++;
  }
  return count;
}

function containsAny(text: string, keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some(kw => n.includes(kw));
}

type MatchStatus = 'match' | 'mismatch' | 'unclear';

function categorize(googleName: string, shelterTitle: string): MatchStatus {
  const gNorm = normalize(googleName);
  const tNorm = normalize(shelterTitle);

  // Direct: google name contains shelter-related keyword
  if (containsAny(googleName, SHELTER_KEYWORDS)) return 'match';

  // Direct: shelter title contains shelter-related keyword and google name is very similar
  if (gNorm === tNorm) return 'match';

  // Check significant word overlap
  const gWords = getSignificantWords(googleName);
  const tWords = getSignificantWords(shelterTitle);
  const overlap = wordOverlap(gWords, tWords);
  const maxLen = Math.max(gWords.size, tWords.size);

  // High overlap = match
  if (maxLen > 0 && overlap / maxLen >= 0.5) return 'match';

  // If google name has a mismatch keyword that is NOT in the shelter title
  const gLower = gNorm;
  for (const kw of MISMATCH_KEYWORDS) {
    if (gLower.includes(kw) && !tNorm.includes(kw)) {
      return 'mismatch';
    }
  }

  // Very low overlap and no shelter keywords = likely mismatch
  if (maxLen > 0 && overlap === 0 && gWords.size >= 1 && tWords.size >= 1) {
    return 'mismatch';
  }

  return 'unclear';
}

async function main() {
  const PAGE = 500;
  let all: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('shelters')
      .select('id, slug, title, google_place_id, google_place_name, google_user_ratings_total, google_rating')
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

  console.log(`Shelters with google_place_id and ratings > 0: ${all.length}\n`);

  // Categorize each
  const results = all.map(s => ({
    ...s,
    status: categorize(s.google_place_name || '', s.title || ''),
  }));

  // Sort by ratings total descending
  results.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));

  // Show top 50
  console.log('='.repeat(100));
  console.log('TOP 50 BY GOOGLE_USER_RATINGS_TOTAL');
  console.log('='.repeat(100));
  console.log(
    'Status'.padEnd(10),
    'Ratings'.padEnd(8),
    'Rating'.padEnd(7),
    'Google Place Name'.padEnd(40),
    'Shelter Title'
  );
  console.log('-'.repeat(100));

  for (const r of results.slice(0, 50)) {
    const statusIcon = r.status === 'match' ? 'MATCH' : r.status === 'mismatch' ? 'MISMATCH' : 'UNCLEAR';
    console.log(
      statusIcon.padEnd(10),
      String(r.google_user_ratings_total).padEnd(8),
      String(r.google_rating?.toFixed(1) || 'N/A').padEnd(7),
      (r.google_place_name || '').substring(0, 38).padEnd(40),
      (r.title || '').substring(0, 40)
    );
  }

  // Summary stats
  const matchCount = results.filter(r => r.status === 'match').length;
  const mismatchCount = results.filter(r => r.status === 'mismatch').length;
  const unclearCount = results.filter(r => r.status === 'unclear').length;

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Total analyzed:  ${results.length}`);
  console.log(`Match:           ${matchCount} (${(100 * matchCount / results.length).toFixed(1)}%)`);
  console.log(`Mismatch:        ${mismatchCount} (${(100 * mismatchCount / results.length).toFixed(1)}%)`);
  console.log(`Unclear:         ${unclearCount} (${(100 * unclearCount / results.length).toFixed(1)}%)`);

  // Show all mismatches
  const mismatches = results.filter(r => r.status === 'mismatch');
  mismatches.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));

  console.log('\n' + '='.repeat(100));
  console.log(`ALL MISMATCHES (${mismatches.length})`);
  console.log('='.repeat(100));
  console.log(
    'Ratings'.padEnd(8),
    'Rating'.padEnd(7),
    'Google Place Name'.padEnd(40),
    'Shelter Title'.padEnd(40),
    'Slug'
  );
  console.log('-'.repeat(100));

  for (const r of mismatches) {
    console.log(
      String(r.google_user_ratings_total).padEnd(8),
      String(r.google_rating?.toFixed(1) || 'N/A').padEnd(7),
      (r.google_place_name || '').substring(0, 38).padEnd(40),
      (r.title || '').substring(0, 38).padEnd(40),
      r.slug || ''
    );
  }

  // Show unclear ones
  const unclear = results.filter(r => r.status === 'unclear');
  unclear.sort((a, b) => (b.google_user_ratings_total || 0) - (a.google_user_ratings_total || 0));

  console.log('\n' + '='.repeat(100));
  console.log(`ALL UNCLEAR (${unclear.length})`);
  console.log('='.repeat(100));
  console.log(
    'Ratings'.padEnd(8),
    'Rating'.padEnd(7),
    'Google Place Name'.padEnd(40),
    'Shelter Title'.padEnd(40),
    'Slug'
  );
  console.log('-'.repeat(100));

  for (const r of unclear) {
    console.log(
      String(r.google_user_ratings_total).padEnd(8),
      String(r.google_rating?.toFixed(1) || 'N/A').padEnd(7),
      (r.google_place_name || '').substring(0, 38).padEnd(40),
      (r.title || '').substring(0, 38).padEnd(40),
      r.slug || ''
    );
  }
}

main().catch(console.error);
