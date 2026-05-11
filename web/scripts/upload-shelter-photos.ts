/**
 * Upload billeder direkte til en shelter (admin bypass — ingen review-kø).
 *
 * Usage:
 *   cd web && npx tsx scripts/upload-shelter-photos.ts \
 *     --slug shelterplads-ved-solvognens-fundsted-11573 \
 *     /sti/til/billede1.jpg /sti/til/billede2.jpg ...
 *
 * Scriptet:
 *   1. Finder shelterens interne Supabase-id ud fra slug
 *   2. Uploader hvert billede til shelter-photos/approved/<uuid>.<ext>
 *   3. Appender billedernes public URL til shelters.user_image_urls
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "shelter-photos";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

function slugArg(): string | null {
  const idx = process.argv.indexOf("--slug");
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function imagePaths(): string[] {
  const slugIdx = process.argv.indexOf("--slug");
  return process.argv.slice(2).filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (slugIdx !== -1 && i === slugIdx - 1) return false; // the --slug value itself
    return true;
  }).filter(a => !a.startsWith("--") && a !== process.argv[slugIdx + 1]);
}

async function main() {
  const slug = slugArg();
  if (!slug) {
    console.error("❌ Angiv --slug <shelter-slug>");
    console.error("   Eksempel: npx tsx scripts/upload-shelter-photos.ts --slug shelterplads-ved-solvognens-fundsted-11573 foto1.jpg foto2.jpg");
    process.exit(1);
  }

  // Collect image paths: everything after the --slug <value> pair
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf("--slug");
  const files = args.filter((_, i) => i !== slugIdx && i !== slugIdx + 1 && !args[i]?.startsWith("--"));

  if (files.length === 0) {
    console.error("❌ Angiv mindst én billedfil som argument");
    process.exit(1);
  }

  // 1. Find shelter
  console.log(`🔍 Finder shelter med slug: ${slug}`);
  const { data: shelter, error: shelterErr } = await supabase
    .from("shelters")
    .select("id, title")
    .eq("slug", slug)
    .single();

  if (shelterErr || !shelter) {
    console.error("❌ Shelter ikke fundet:", shelterErr?.message ?? "ukendt fejl");
    process.exit(1);
  }

  console.log(`✅ Fandt shelter: "${shelter.title}" (id: ${shelter.id})`);

  let uploadCount = 0;

  // 2. Upload each file and atomically append its URL
  for (const filePath of files) {
    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
      console.warn(`⚠️  Filen findes ikke, springer over: ${absPath}`);
      continue;
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeType = MIME[ext];
    if (!mimeType) {
      console.warn(`⚠️  Ikke-understøttet filtype (${ext}), springer over: ${absPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(absPath);
    const storagePath = `owner/${shelter.id}/${crypto.randomUUID()}${ext}`;

    console.log(`📤 Uploader ${path.basename(absPath)} → ${storagePath}...`);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      console.error(`❌ Upload fejlede for ${path.basename(absPath)}:`, uploadErr.message);
      continue;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    // Atomic append — avoids read-modify-write race condition
    const { error: appendErr } = await supabase.rpc("append_user_image_url", {
      p_shelter_id: shelter.id,
      p_url: publicUrl,
    });

    if (appendErr) {
      console.error(`❌ Kunne ikke gemme URL for ${path.basename(absPath)}:`, appendErr.message);
      console.log(`   Billedet er uploadet men ikke gemt: ${publicUrl}`);
      continue;
    }

    console.log(`   ✅ Gemt: ${publicUrl}`);
    uploadCount++;
  }

  if (uploadCount === 0) {
    console.error("❌ Ingen billeder blev uploadet");
    process.exit(1);
  }

  console.log(`\n🎉 Færdig! ${uploadCount} billede(r) tilføjet til "${shelter.title}"`);
  console.log(`\n   🔗 https://shelterdk.dk/shelter/${slug}`);
}

main().catch((err) => {
  console.error("Uventet fejl:", err);
  process.exit(1);
});
