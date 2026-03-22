import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  // Fetch ALL shelters
  const PAGE = 500;
  let all: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('shelters').select('id, slug, title, description, geofa_raw, water, toilet, google_rating, region, capacity, booking_url, is_free, wheelchair_accessible, area_slug, kommune').range(offset, offset + PAGE - 1).limit(PAGE);
    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }
  console.log(`Total shelters: ${all.length}\n`);

  // Get existing community facts (paginated)
  let factsAll: any[] = [];
  offset = 0;
  while (true) {
    const { data: fb } = await supabase.from('shelter_community_facts').select('*').range(offset, offset + PAGE - 1).limit(PAGE);
    if (!fb || fb.length === 0) break;
    factsAll.push(...fb);
    offset += PAGE;
    if (fb.length < PAGE) break;
  }
  const factIds = new Set(factsAll.map((f: any) => f.shelter_id));
  const factMap = new Map(factsAll.map((f: any) => [f.shelter_id, f]));
  console.log(`Shelters with community facts: ${factIds.size}\n`);

  // Combine all text for each shelter
  function getText(s: any): string {
    const parts: string[] = [];
    if (s.description) parts.push(String(s.description));
    const raw = s.geofa_raw || {};
    for (const key of ['lang_beskr', 'lang_besk', 'd_k_beskr', 'beskrivels', 'facilitet', 'bemærkni', 'bem_rkni']) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim()) parts.push(v);
    }
    return parts.join(' ');
  }

  // ========== ANALYSIS 1: Most common words/phrases in descriptions ==========
  console.log('='.repeat(60));
  console.log('ANALYSE 1: Hyppige facilitets-relaterede ord i beskrivelser');
  console.log('='.repeat(60));
  
  const interestingPatterns: Record<string, RegExp> = {
    'bænk/bænke': /\bbænk/i,
    'bord': /\bbord\b/i,
    'shelter (som ord)': /\bshelter/i,
    'madpakkehus': /madpakkehus/i,
    'grill': /\bgrill/i,
    'kano/kajak': /\b(kano|kajak)/i,
    'cykel/cykling': /\b(cykel|cykl)/i,
    'handicap/kørestol': /\b(handicap|kørestol|tilgæng)/i,
    'strand': /\bstrand/i,
    'skov': /\bskov/i,
    'sø/å': /\b(sø\b|å\b|åen\b|søen\b)/i,
    'udsigt': /\budsigt/i,
    'solcelle/strøm': /\b(solcelle|strøm|el-|230v|stikkontakt)/i,
    'wifi/internet': /\b(wifi|internet|wi-fi)/i,
    'affald/skrald': /\b(affald|skrald|renovation)/i,
    'overdækket': /\boverdækk/i,
    'bruser/bad': /\b(bruser|bad\b|baderum|brusebad)/i,
    'køkken': /\bkøkken/i,
    'køleskab': /\bkøleskab/i,
    'madlavning/komfur': /\b(madlavning|komfur|kogeplads|gasblus|kogeapparat)/i,
    'tørrerum': /\btørrerum/i,
    'vaskerum/vaskemaskine': /\b(vaskerum|vaskemaskine)/i,
    'spejder': /\bspejder/i,
    'overnatning/sove': /\b(overnatning|sovepose|soverum|soveplads)/i,
    'nøgle': /\bnøgle/i,
    'reservation/book': /\b(reservation|booking|reserv|book)/i,
    'gratis': /\bgratis/i,
    'betaling/betale': /\b(betaling|betal|kr\.|kroner|pris)/i,
    'adgang/adgangs': /\badgang/i,
    'sti/stien': /\b(sti\b|stien\b|stisystem|vandrerute)/i,
    'fugletårn/fugle': /\b(fugletårn|fuglekig|fugle)/i,
    'lege': /\blege\b/i,
    'svømning/svømme': /\b(svøm|bade)/i,
    'mountainbike/mtb': /\b(mountainbike|mtb|mountain)/i,
  };

  const counts: [string, number, string[]][] = [];
  for (const [label, regex] of Object.entries(interestingPatterns)) {
    let count = 0;
    const examples: string[] = [];
    for (const s of all) {
      const text = getText(s);
      if (regex.test(text)) {
        count++;
        if (examples.length < 3) {
          const match = text.match(regex);
          const idx = text.search(regex);
          const ctx = text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 40)).replace(/\n/g, ' ');
          examples.push(`${s.slug}: "...${ctx}..."`);
        }
      }
    }
    counts.push([label, count, examples]);
  }
  counts.sort((a, b) => b[1] - a[1]);
  for (const [label, count, examples] of counts) {
    console.log(`\n${label}: ${count} shelters`);
    for (const ex of examples) console.log(`  ${ex}`);
  }

  // ========== ANALYSIS 2: geofa_raw fields we're NOT using ==========
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSE 2: Alle geofa_raw felter og deres værdier');
  console.log('='.repeat(60));
  
  const fieldValues: Record<string, Map<string, number>> = {};
  const fieldCounts: Record<string, number> = {};
  
  for (const s of all) {
    const raw = s.geofa_raw || {};
    for (const [key, val] of Object.entries(raw)) {
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      if (!fieldValues[key]) fieldValues[key] = new Map();
      const v = String(val).slice(0, 80);
      fieldValues[key].set(v, (fieldValues[key].get(v) || 0) + 1);
    }
  }
  
  const sortedFields = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedFields) {
    console.log(`\n📊 ${key}: ${count} shelters`);
    const vals = [...fieldValues[key].entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [v, c] of vals) {
      console.log(`    "${v}" (${c}x)`);
    }
  }

  // ========== ANALYSIS 3: Shelters with NO community facts — what are we missing? ==========
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSE 3: Shelters UDEN community facts — hvad står i teksten?');
  console.log('='.repeat(60));
  
  const withoutFacts = all.filter(s => !factIds.has(s.id));
  console.log(`\nShelters uden community facts: ${withoutFacts.length}`);
  
  // Check what keywords appear in their descriptions
  const missingKeywords: Record<string, number> = {};
  const facilityPatterns: Record<string, RegExp> = {
    'toilet': /\btoilet/i,
    'vand': /\b(vand|drikkevand|vandhane)/i,
    'bål': /\bbål/i,
    'parkering': /\bparkering/i,
    'telt': /\btelt/i,
    'hund': /\bhund/i,
    'fiskeri': /\bfisk/i,
    'brænde': /\bbrænde/i,
    'legeplads': /\blegeplads/i,
  };
  
  for (const s of withoutFacts) {
    const text = getText(s);
    for (const [label, regex] of Object.entries(facilityPatterns)) {
      if (regex.test(text)) {
        missingKeywords[label] = (missingKeywords[label] || 0) + 1;
      }
    }
  }
  
  console.log('\nFacilitets-ord i shelters UDEN community facts:');
  for (const [label, count] of Object.entries(missingKeywords).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label}: ${count}`);
  }

  // ========== ANALYSIS 4: Regions/areas distribution ==========
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSE 4: Regionfordeling');
  console.log('='.repeat(60));
  
  const regionCounts: Record<string, number> = {};
  for (const s of all) {
    const r = s.region || 'INGEN';
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  }
  for (const [r, c] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${c}`);
  }

  // ========== ANALYSIS 5: Rating distribution ==========
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSE 5: Rating distribution');
  console.log('='.repeat(60));
  
  const rated = all.filter(s => s.google_rating && s.google_rating > 0);
  const unrated = all.filter(s => !s.google_rating || s.google_rating === 0);
  console.log(`Med rating: ${rated.length}`);
  console.log(`Uden rating: ${unrated.length}`);
  if (rated.length > 0) {
    const avg = rated.reduce((sum: number, s: any) => sum + s.google_rating, 0) / rated.length;
    console.log(`Gennemsnit: ${avg.toFixed(2)}`);
    const dist: Record<number, number> = {};
    for (const s of rated) {
      const bucket = Math.floor(s.google_rating);
      dist[bucket] = (dist[bucket] || 0) + 1;
    }
    for (const [bucket, count] of Object.entries(dist).sort()) {
      console.log(`  ${bucket}-${Number(bucket)+1}: ${count}`);
    }
  }
}

main().catch(console.error);
