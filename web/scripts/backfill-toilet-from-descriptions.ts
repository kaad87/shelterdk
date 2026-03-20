import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Udtrækker toilettype fra beskrivelse.
 * Returnerer 'mulch', 'flush' eller null (ingen match).
 * Negationer som "ingen toilet" og "ikke toilet" håndteres.
 */
function extractToilet(description: string): 'mulch' | 'flush' | null {
  const text = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // Negationer: "ingen toilet", "ikke toilet", "uden toilet"
  const negations = [
    /ingen\s+(?:adgang\s+til\s+)?toilet/i,
    /ikke\s+(?:adgang\s+til\s+)?toilet/i,
    /uden\s+toilet/i,
    /intet\s+toilet/i,
  ];
  // Tjek om hele teksten primært negerer toilet
  if (negations.some(p => p.test(text))) {
    // Men "muldtoilet" i nærheden overrider negation
    if (!/muldtoilet/i.test(text) && !/mulch/i.test(text)) {
      return null;
    }
  }

  // Muldtoilet varianter
  if (/muldtoilet/i.test(text)) return 'mulch';
  if (/komposttoilet/i.test(text)) return 'mulch';
  if (/tørkloset/i.test(text)) return 'mulch';
  if (/torrtoalett/i.test(text)) return 'mulch';
  if (/multtoilet/i.test(text)) return 'mulch'; // common typo
  if (/das\b/i.test(text) && !/pladas/i.test(text)) return 'mulch';

  // Flush toilet
  if (/vandkloset/i.test(text)) return 'flush';
  if (/toiletbygning/i.test(text)) return 'flush';
  if (/offentlig(?:t)?\s+toilet/i.test(text)) return 'flush';

  // Generic toilet mentions — default to 'flush' unless context suggests otherwise
  if (/\btoilet(?:ter|tet)?\b/i.test(text)) return 'flush';
  if (/\bwc\b/i.test(text)) return 'flush';

  return null;
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const PAGE = 500;
  let all: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('shelters')
      .select('id, title, description, toilet')
      .is('duplicate_of_shelter_id', null)
      .eq('toilet', 'unknown')
      .not('description', 'is', null)
      .range(offset, offset + PAGE - 1)
      .limit(PAGE);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Shelters med toilet=unknown og beskrivelse: ${all.length}`);

  let toFlush: any[] = [];
  let toMulch: any[] = [];
  let noMatch = 0;

  for (const s of all) {
    const result = extractToilet(s.description || '');
    if (result === 'flush') toFlush.push(s);
    else if (result === 'mulch') toMulch.push(s);
    else noMatch++;
  }

  console.log(`\nResultat:`);
  console.log(`  → flush: ${toFlush.length}`);
  console.log(`  → mulch: ${toMulch.length}`);
  console.log(`  → ingen match: ${noMatch}`);

  console.log(`\nEksempler (flush):`);
  for (const s of toFlush.slice(0, 5)) {
    const desc = (s.description || '').replace(/<[^>]*>/g, ' ').substring(0, 120);
    console.log(`  ${s.title}: ${desc}`);
  }

  console.log(`\nEksempler (mulch):`);
  for (const s of toMulch.slice(0, 5)) {
    const desc = (s.description || '').replace(/<[^>]*>/g, ' ').substring(0, 120);
    console.log(`  ${s.title}: ${desc}`);
  }

  if (DRY_RUN) {
    console.log(`\n🔶 DRY RUN — ville have opdateret ${toFlush.length + toMulch.length} shelters.`);
    return;
  }

  console.log(`\n📝 Opdaterer ${toFlush.length + toMulch.length} shelters...`);
  let updated = 0;
  let errors = 0;

  for (const s of toMulch) {
    const { error } = await supabase.from('shelters').update({ toilet: 'mulch' }).eq('id', s.id);
    if (error) { errors++; } else { updated++; }
  }
  for (const s of toFlush) {
    const { error } = await supabase.from('shelters').update({ toilet: 'flush' }).eq('id', s.id);
    if (error) { errors++; } else { updated++; }
  }

  console.log(`✅ Opdateret: ${updated}`);
  if (errors) console.log(`❌ Fejl: ${errors}`);
}

main().catch(console.error);
