#!/usr/bin/env node
/**
 * Outreach-script til ShelterDK booking-system
 *
 * Brug:
 *   node scripts/outreach.js list                   → vis kandidater
 *   node scripts/outreach.js setup <slug>           → opret shelter + vis begge mail-varianter
 *   node scripts/outreach.js setup <slug> --exists  → shelter er allerede oprettet, vis bare mails
 *
 * Eksempel:
 *   node scripts/outreach.js setup hedeskoven-84909
 */

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");

// Indlæs env
function loadEnv() {
  const envFiles = [
    path.join(__dirname, "../.env"),
    path.join(__dirname, "../web/.env.local"),
  ];
  for (const f of envFiles) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── SQL til at finde kandidater ───────────────────────────────────────────

async function listCandidates() {
  const { data, error } = await supabase
    .from("shelters")
    .select("id, title, owner_name, owner_type, contact, slug")
    .not("contact", "is", null)
    .ilike("contact", "%@%")
    .is("booking_url", null)
    .not("owner_name", "ilike", "%naturstyrelsen%")
    .not("owner_name", "ilike", "%kommune%")
    .order("owner_type")
    .limit(500);

  if (error) {
    console.error("Fejl ved hentning:", error.message);
    process.exit(1);
  }

  // Filtrer på email-regex og fjern dem der allerede er i bookable_shelters
  const { data: existing } = await supabase
    .from("bookable_shelters")
    .select("shelter_id");
  const existingIds = new Set((existing || []).map((r) => r.shelter_id));

  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  const candidates = (data || []).filter(
    (s) => EMAIL_RE.test(s.contact || "") && !existingIds.has(s.id)
  );

  if (candidates.length === 0) {
    console.log("Ingen kandidater fundet.");
    return;
  }

  console.log(`\n${"─".repeat(80)}`);
  console.log(`KANDIDATER (${candidates.length} shelters)\n`);
  candidates.forEach((s, i) => {
    const email = (s.contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || ["?"])[0];
    console.log(`${String(i + 1).padStart(3)}. ${s.title}`);
    console.log(`     Ejer: ${s.owner_name || "ukendt"} (${s.owner_type || "?"})`)
    console.log(`     Mail: ${email}`);
    console.log(`     Slug: ${s.slug}`);
    console.log();
  });
  console.log(`Kør: node scripts/outreach.js setup <slug>`);
}

// ─── Opret bookable shelter + vis mails ────────────────────────────────────

async function setup(slug, alreadyExists) {
  // Hent shelter
  const { data: shelter, error: shelterErr } = await supabase
    .from("shelters")
    .select("id, title, contact, capacity, owner_name, slug")
    .eq("slug", slug)
    .single();

  if (shelterErr || !shelter) {
    console.error(`Shelter '${slug}' ikke fundet.`);
    process.exit(1);
  }

  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const email = (shelter.contact?.match(EMAIL_RE) || [""])[0];
  if (!email) {
    console.error("Ingen email fundet i kontaktfeltet.");
    process.exit(1);
  }

  let bookable;

  if (alreadyExists) {
    // Hent eksisterende record
    const { data: existing } = await supabase
      .from("bookable_shelters")
      .select("*")
      .eq("shelter_id", shelter.id)
      .single();
    if (!existing) {
      console.error("Shelter er ikke oprettet i bookable_shelters. Kør uden --exists.");
      process.exit(1);
    }
    bookable = existing;
    console.log(`\n✓ Bruger eksisterende bookable shelter: ${bookable.id}`);
  } else {
    // Tjek om den allerede eksisterer
    const { data: existing } = await supabase
      .from("bookable_shelters")
      .select("id, slug, owner_token")
      .eq("shelter_id", shelter.id)
      .single();

    if (existing) {
      console.log(`\n⚠️  Shelter er allerede oprettet. Bruger eksisterende record.`);
      bookable = existing;
    } else {
      // Opret ny
      const ownerToken = randomUUID();
      const bookableSlug = shelter.slug;
      const { data: created, error: createErr } = await supabase
        .from("bookable_shelters")
        .insert({
          slug: bookableSlug,
          title: shelter.title,
          shelter_id: shelter.id,
          owner_email: email,
          owner_token: ownerToken,
          max_persons: shelter.capacity || 6,
          booking_mode: "shelterdk",
          payment_mode: "after_confirmation",
          shelter_price_dkk: null,
          platform_fee_pct: 0,
          platform_fee_min_dkk: 20,
          cancellation_cutoff_hours: 48,
        })
        .select()
        .single();

      if (createErr) {
        console.error("Fejl ved oprettelse:", createErr.message);
        process.exit(1);
      }
      bookable = created;
      console.log(`\n✓ Bookable shelter oprettet!`);
    }
  }

  const bookingUrl = `https://shelterdk.dk/embed/book/${bookable.slug}`;
  const dashboardUrl = `https://shelterdk.dk/owner/${bookable.owner_token}`;
  const shelterUrl = `https://shelterdk.dk/shelter/${shelter.slug}`;

  // Udled fornavn — ignorer generiske værdier
  const GENERIC = ["privat", "forening", "ejer", "ukendt", ""];
  const rawFirst = (shelter.owner_name || "").split(" ")[0].toLowerCase();
  const firstName = GENERIC.includes(rawFirst) ? null : (shelter.owner_name || "").split(" ")[0];

  printEmails({ shelter, email, bookingUrl, dashboardUrl, shelterUrl, firstName, ownerToken: bookable.owner_token });
}

// ─── Mail-templates ────────────────────────────────────────────────────────

function printEmails({ shelter, email, bookingUrl, dashboardUrl, shelterUrl, firstName, ownerToken }) {
  const greeting = firstName ? `Hej ${firstName}` : `Hej`;
  const divider = "═".repeat(80);
  const dividerSmall = "─".repeat(80);

  console.log(`\n${divider}`);
  console.log(`SHELTER: ${shelter.title}`);
  console.log(`Email:   ${email}`);
  console.log(`Dashboard: ${dashboardUrl}`);
  console.log(`Booking:   ${bookingUrl}`);
  console.log(divider);

  // ── MAIL 1: Uden betaling (ejeren modtager ikke penge fra gæster) ─────────
  console.log(`\n${"▓".repeat(80)}`);
  console.log(`MAIL 1 — UDEN BETALING (gæsterne betaler kun bookinggebyr til ShelterDK)`);
  console.log(`${"▓".repeat(80)}\n`);

  console.log(`TIL: ${email}`);
  console.log(`EMNE: Shelter booking system\n`);
  console.log(`---KOPIER FRA HER---\n`);
  console.log(`${greeting}

Jeg hedder Christian og driver platformen ShelterDK.dk. Vores mission er enkel: Vi vil skabe et samlet, overskueligt overblik over Danmarks mange shelters, så det bliver nemmere for danskerne at komme ud og nyde naturen. Du kan læse lidt mere om tankerne bag projektet i denne artikel fra Politiken: https://politiken.dk/rejser/art10803977/Holder-du-af-sheltere-er-det-her-m%C3%A5ske-nyheden-du-har-ventet-p%C3%A5

Jeg skriver til dig, fordi vi har rigtig mange brugere der kigger på jeres shelter: ${shelterUrl}

En af de absolut største frustrationer for friluftsfolk er frygten for at pakke rygsækken, vandre afsted, og så opdage, at shelteret allerede er optaget. Når vi fjerner den usikkerhed og lader folk booke på forhånd, oplever vi faktisk, at shelteret bruges af endnu flere. Det tiltrækker nemlig dem, der ellers helt fravælger turen på grund af usikkerheden, for eksempel børnefamilier eller folk, der kommer langvejsfra.

Jeg har bygget et simpelt bookingsystem som I kan få lov at bruge helt uden omkostninger for jer. Jeg har tilladt mig at lave en demo specifikt til jer:

Booking-siden: ${bookingUrl}
Ejer-dashboardet (din side): ${dashboardUrl}

Du kan klikke rundt i begge links og se præcis, hvad en gæst oplever, og hvad du som ejer ser bagefter.

Her er hvad systemet gør for jer i praksis:

- Gæsten booker via system: Brugere kan booke shelteret ud i fremtiden.
- Du godkender eller afviser: Du beholder fuld kontrol. Systemet sender besked og lukker datoerne automatisk.
- Eller: Hvis man foretrækker det, kan systemet sættes op, så gæsten booker med det samme uden at vente på godkendelse.
- Kalendersynkronisering: Bookinger opdaterer automatisk jeres kalender, og manuelle bookinger I selv laver blokerer datoerne online.
- Besked-system: Muligheder for at kommunikere med den besøgende frem og tilbage.
- Autogenerede beskeder: Systemet sender autogenerede beskeder baseret på dit shelter i beskeden.

For at systemet kan køre rundt er det skruet sådan sammen, at det koster brugeren et lille bookinggebyr på 20 kr. Det minimerer no-shows markant, da en gratis booking nemt bare glemmes.

Til sidst: jeg er ved at producere skilte med QR-kode til de shelters der er med i systemet. Vil du have, at jeg sender et til jer? Teksten på skiltet vil være noget i stil med:

    Dette shelter kan bookes. Har du booket på forhånd, er pladsen din. Opholder du dig her uden booking, bedes du venligst vige pladsen, hvis en gæst møder op med en bekræftet booking. Book via QR-koden eller på shelterdk.dk.

Det blev lidt langt! Men prøv demoen, hvis du har lyst, og fortæl mig hvad du tænker. Helt uforpligtende.

Med venlig hilsen
Christian
ShelterDK.dk`);

  console.log(`\n---STOP KOPIERING HER---`);

  // ── MAIL 2: Med betaling (ejeren modtager penge fra gæster) ──────────────
  console.log(`\n${"▓".repeat(80)}`);
  console.log(`MAIL 2 — MED BETALING (ejeren modtager overnatningspris fra gæster)`);
  console.log(`${"▓".repeat(80)}\n`);

  console.log(`TIL: ${email}`);
  console.log(`EMNE: Shelter booking system\n`);
  console.log(`---KOPIER FRA HER---\n`);
  console.log(`${greeting}

Jeg hedder Christian og driver platformen ShelterDK.dk. Vores mission er enkel: Vi vil skabe et samlet, overskueligt overblik over Danmarks mange shelters, så det bliver nemmere for danskerne at komme ud og nyde naturen. Du kan læse lidt mere om tankerne bag projektet i denne artikel fra Politiken: https://politiken.dk/rejser/art10803977/Holder-du-af-sheltere-er-det-her-m%C3%A5ske-nyheden-du-har-ventet-p%C3%A5

Jeg skriver til dig, fordi vi har rigtig mange brugere der kigger på jeres shelter: ${shelterUrl}

En af de absolut største frustrationer for friluftsfolk er frygten for at pakke rygsækken, vandre afsted, og så opdage, at shelteret allerede er optaget. Når vi fjerner den usikkerhed og lader folk booke på forhånd, oplever vi faktisk, at shelteret bruges af endnu flere. Det tiltrækker nemlig dem, der ellers helt fravælger turen på grund af usikkerheden, for eksempel børnefamilier eller folk, der kommer langvejsfra.

Jeg har bygget et simpelt bookingsystem som I kan få lov at bruge helt uden omkostninger for jer. Jeg har tilladt mig at lave en demo specifikt til jer:

Booking-siden: ${bookingUrl}
Ejer-dashboardet (din side): ${dashboardUrl}

Du kan klikke rundt i begge links og se præcis, hvad en gæst oplever, og hvad du som ejer ser bagefter.

Her er hvad systemet gør for jer i praksis:

- Gæsten betaler det samme: Via MobilePay eller kort. Ingen betaling, ingen booking. Du slipper for at rykke.
- Du godkender eller afviser: Du beholder fuld kontrol. Systemet sender besked og lukker datoerne automatisk.
- Eller: Betal og book på en gang, hvis man foretrækker det.
- Udbetaling den 1. i måneden: Alle betalinger samles og overføres direkte til jeres konto. Ingen separate overførsler at bogføre.
- Kalendersynkronisering: Bookinger opdaterer automatisk jeres kalender, og manuelle bookinger I selv laver blokerer datoerne online.
- Besked-system: Muligheder for at kommunikere med den besøgende frem og tilbage.
- Autogenerede beskeder: Systemet sender autogenerede beskeder baseret på dit shelter i beskeden.

For at systemet kan køre rundt er det skruet sådan sammen, at det koster brugeren et lille bookinggebyr. Det minimerer no-shows markant, da en gratis booking nemt bare glemmes.

Til sidst: jeg er ved at producere skilte med QR-kode til de shelters der er med i systemet. Vil du have, at jeg sender et til jer? Teksten på skiltet vil være noget i stil med:

    Dette shelter kan bookes. Har du booket på forhånd, er pladsen din. Opholder du dig her uden booking, bedes du venligst vige pladsen, hvis en gæst møder op med en bekræftet booking. Book via QR-koden eller på shelterdk.dk.

Det blev lidt langt! Men prøv demoen, hvis du har lyst, og fortæl mig hvad du tænker. Helt uforpligtende.

Med venlig hilsen
Christian
ShelterDK.dk`);

  console.log(`\n---STOP KOPIERING HER---\n`);
  console.log(`${"═".repeat(80)}\n`);
}

// ─── Hovedprogram ──────────────────────────────────────────────────────────

const [,, cmd, arg, flag] = process.argv;

if (cmd === "list") {
  listCandidates().catch(console.error);
} else if (cmd === "setup" && arg) {
  setup(arg, flag === "--exists").catch(console.error);
} else {
  console.log(`
ShelterDK Outreach Script
─────────────────────────
Brug:
  node scripts/outreach.js list              Vis kandidater
  node scripts/outreach.js setup <slug>      Opret shelter + vis mails
  node scripts/outreach.js setup <slug> --exists   Kun vis mails (allerede oprettet)
  `);
}
