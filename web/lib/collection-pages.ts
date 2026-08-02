/**
 * Datalag for tema-samlesider (/teltplads, /baalhytte, /arla-oeko-shelter …).
 *
 * Baggrunden er et konkret hul i Search Console: folk søger på BEGREBER
 * ("teltplads", "bålhytte", "arla øko shelter"), mens vores indhold kun findes
 * som enkelte shelter-sider. Resultatet er at vores egne sider konkurrerer
 * indbyrdes om samme søgning — "arla øko shelter" havde 550 visninger på plads
 * 9,1 med NUL klik, fordelt på otte separate sider. En samleside fjerner den
 * kannibalisering og matcher det brugeren faktisk søger efter.
 */

import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getDisplayScore, hasAnyImage } from "@/lib/shelter-detail";

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, booking_url, booking_link_mode, duplicate_of_shelter_id, region, kommune, place, water, toilet, capacity, geofa_raw, display_score, featured_sort_boost, bookable_shelters(id), blur_data_url";

// BEMÆRK: "lejrplads" er bevidst IKKE en egen samleside. Alle 66 lejrpladser
// indgår i /teltplads (273 pladser), og en separat side ville kannibalisere den
// — præcis det problem samlesiderne skal løse. /teltplads dækker begge begreber
// i sin tekst i stedet.
export type CollectionKey =
  | "teltplads"
  | "baalhytte"
  | "arla"
  | "haervejen"
  | "gudenaaen";

export interface CollectionConfig {
  key: CollectionKey;
  /** URL uden foranstillet skråstreg-segment, fx "teltplads" → /teltplads */
  slug: string;
  h1: string;
  titleTemplate: (count: number) => string;
  description: (count: number) => string;
  /** Kort intro over listen. */
  intro: (count: number) => string;
  faq: { question: string; answer: string }[];
}

/**
 * Udvælgelseskriterier. Holdes i SQL-form fordi de kombinerer autoritative
 * GeoFA-felter med titel-match: GeoFA har fx et `teltplads`-flag på 208 pladser,
 * hvilket er langt mere pålideligt end at gætte ud fra navnet, men enkelte
 * pladser hedder "…teltplads" uden at have flaget sat.
 */
const FILTERS: Record<CollectionKey, (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>> = {
  teltplads: (q) =>
    q.or("geofa_raw->>teltplads.ilike.%ja%,title.ilike.%teltplads%,title.ilike.%lejrplads%"),
  baalhytte: (q) => q.or("title.ilike.%bålhytte%,title.ilike.%baalhytte%"),
  arla: (q) => q.ilike("title", "%arla%"),
  haervejen: (q) => q.or("title.ilike.%hærvej%,description.ilike.%hærvejen%"),
  gudenaaen: (q) => q.or("title.ilike.%gudenå%,description.ilike.%gudenåen%"),
};

function baseQuery() {
  return createPublicClient()
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null);
}

function sortByImageAndScore(a: Shelter, b: Shelter): number {
  const aHas = hasAnyImage(a) ? 1 : 0;
  const bHas = hasAnyImage(b) ? 1 : 0;
  if (bHas !== aHas) return bHas - aHas;
  const diff =
    (b.display_score ?? getDisplayScore(b)) - (a.display_score ?? getDisplayScore(a));
  return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
}

/** Proces-cache: samlesiderne er ISR-cachede, men flere kan revalidere samtidig. */
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<CollectionKey, { shelters: Shelter[]; expires: number }>();
const inflight = new Map<CollectionKey, Promise<Shelter[]>>();

export async function getCollectionShelters(key: CollectionKey): Promise<Shelter[]> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.shelters;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const { data, error } = await FILTERS[key](baseQuery())
        .order("display_score", { ascending: false, nullsFirst: false })
        // Højt nok til at rumme den største samling (/teltplads: 273), så
        // antallet i titel og intro er det faktiske — ikke afkortet af grænsen.
        .limit(400);
      if (error) {
        console.error(`Supabase error (collection ${key}):`, error);
        return [];
      }
      const list = ((data as unknown as Shelter[]) ?? []).slice();
      list.sort(sortByImageAndScore);
      if (list.length > 0) cache.set(key, { shelters: list, expires: Date.now() + TTL_MS });
      return list;
    } catch (err) {
      console.error(`Supabase error (collection ${key}):`, err);
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export const COLLECTIONS: Record<CollectionKey, CollectionConfig> = {
  teltplads: {
    key: "teltplads",
    slug: "teltplads",
    h1: "Teltpladser i Danmark",
    titleTemplate: (n) => `Teltplads i Danmark – ${n} pladser | ShelterDK`,
    description: (n) =>
      `Find teltplads i Danmark. ${n} primitive teltpladser og lejrpladser med kort, faciliteter og priser – både gratis og bookbare.`,
    intro: (n) =>
      `Her finder du ${n} teltpladser og lejrpladser i Danmark, hvor du må slå dit eget telt op. I modsætning til en campingplads er de fleste primitive: du får typisk et bålsted, et muldtoilet og adgang til vand, men sjældent strøm eller bad. Mange ligger i statsskove eller ved søer og kyster, og en del kan bookes online.`,
    faq: [
      {
        question: "Hvad er forskellen på en teltplads og en shelterplads?",
        answer:
          "På en teltplads slår du dit eget telt op, mens en shelterplads har en åben træhytte du kan sove i. Mange pladser i Danmark er begge dele — der er en shelter, og der er plads til telte ved siden af. På listen her er begge typer med, så længe der er plads til telt.",
      },
      {
        question: "Må man slå telt op hvor som helst i Danmark?",
        answer:
          "Nej. I private skove og på private arealer kræver det ejerens tilladelse. I statsskove må du frit overnatte ét døgn i en teltplads-zone eller på de udpegede fri teltningsarealer. På de anviste teltpladser er det altid tilladt, og nogle kræver booking.",
      },
      {
        question: "Koster det noget at bruge en teltplads?",
        answer:
          "Mange primitive teltpladser i statsskovene er gratis. Andre koster typisk 30-75 kr. per person per nat, særligt hvis de har toilet, vand og bålplads. Prisen fremgår af den enkelte plads.",
      },
      {
        question: "Kan man booke teltplads på forhånd?",
        answer:
          "En del af pladserne kan bookes — enten via Naturstyrelsen, udinaturen.dk eller direkte hos ejeren. Resten fungerer efter først-til-mølle. Filtrér på bookbare pladser hvis du vil være sikker på plads i højsæsonen.",
      },
    ],
  },
  baalhytte: {
    key: "baalhytte",
    slug: "baalhytte",
    h1: "Bålhytter i Danmark",
    titleTemplate: (n) => `Bålhytte i Danmark – ${n} pladser | ShelterDK`,
    description: (n) =>
      `Find bålhytte i Danmark. ${n} bålhytter med overdækket bålsted – perfekt til grupper, skoleklasser og ture i dårligt vejr.`,
    intro: (n) =>
      `En bålhytte er en overdækket konstruktion med bålsted i midten, hvor røgen trækker ud gennem hullet i taget. Den er ideel når vejret driller, og til grupper der skal lave mad sammen. Her er ${n} bålhytter i Danmark med kort, faciliteter og information om booking.`,
    faq: [
      {
        question: "Hvad er en bålhytte?",
        answer:
          "En bålhytte er en overdækket, ofte sekskantet træhytte med et bålsted i midten og åbne eller halvåbne sider. Røgen trækker ud gennem et hul i taget. Den bruges til madlavning og samvær i læ — ikke nødvendigvis til at sove i.",
      },
      {
        question: "Kan man sove i en bålhytte?",
        answer:
          "Det varierer. Nogle bålhytter har siddebænke der kan bruges til at sove på, mens andre kun er beregnet til ophold. Mange steder ligger bålhytten sammen med shelters eller en teltplads, så du kan lave mad i hytten og sove ved siden af.",
      },
      {
        question: "Skal man booke en bålhytte?",
        answer:
          "Bålhytter er populære til skoleklasser, spejdere og fødselsdage, så flere steder kræver booking — særligt i weekender og skoleferier. Se den enkelte plads for booking-information.",
      },
    ],
  },
  arla: {
    key: "arla",
    slug: "arla-oeko-shelter",
    h1: "Arla ØKO Shelters",
    titleTemplate: (n) => `Arla ØKO Shelter – alle ${n} pladser | ShelterDK`,
    description: (n) =>
      `Alle ${n} Arla ØKO Shelters i Danmark. Overnat gratis på en økologisk gård – se kort, faciliteter og hvordan du booker.`,
    intro: (n) =>
      `Arla ØKO Shelter er et samarbejde mellem Arla og økologiske mælkeproducenter, hvor du kan overnate gratis i en shelter på gårdens jord. Idéen er at komme tæt på det økologiske landbrug — mange steder kan du se køerne komme ind til malkning. Her er alle ${n} pladser samlet ét sted.`,
    faq: [
      {
        question: "Hvad er et Arla ØKO Shelter?",
        answer:
          "Det er shelters opstillet på økologiske Arla-gårde rundt om i Danmark. Konceptet giver besøgende mulighed for at overnatte gratis i naturen tæt på et arbejdende landbrug og se hvordan økologisk mælkeproduktion foregår.",
      },
      {
        question: "Koster det noget at overnatte i et Arla ØKO Shelter?",
        answer:
          "Nej, overnatning er gratis. Til gengæld forventes det at du rydder op efter dig og respekterer at du er gæst på en gård med dyr og maskiner i drift.",
      },
      {
        question: "Skal man booke på forhånd?",
        answer:
          "De fleste Arla ØKO Shelters fungerer efter først-til-mølle, men enkelte gårde vil gerne kontaktes først. Se den enkelte plads for kontaktoplysninger.",
      },
      {
        question: "Må man tage hunden med?",
        answer:
          "Det afhænger af gården. Fordi der er husdyr, er hunde ofte kun tilladt i snor eller slet ikke. Tjek den enkelte plads inden du tager afsted.",
      },
    ],
  },
  haervejen: {
    key: "haervejen",
    slug: "haervejen",
    h1: "Shelters langs Hærvejen",
    titleTemplate: (n) => `Shelter langs Hærvejen – ${n} pladser | ShelterDK`,
    description: (n) =>
      `${n} shelters og overnatningspladser langs Hærvejen. Planlæg etaperne på Danmarks ældste vandrerute med kort og faciliteter.`,
    intro: (n) =>
      `Hærvejen løber fra Padborg i syd til Viborg og videre mod Frederikshavn — Danmarks ældste færdselsåre og i dag en af landets mest brugte vandre- og cykelruter. Her er ${n} shelters og primitive overnatningspladser på eller tæt ved ruten, så du kan planlægge etaperne efter hvor du kan sove.`,
    faq: [
      {
        question: "Hvor mange dage tager det at vandre Hærvejen?",
        answer:
          "Hele strækningen fra Padborg til Viborg er cirka 290 km og tager typisk 12-15 dage til fods. Mange går kortere etaper på 3-5 dage, fx Viborg-Jelling eller Jelling-Padborg.",
      },
      {
        question: "Kan man overnatte gratis langs Hærvejen?",
        answer:
          "Ja. En stor del af pladserne langs ruten er primitive shelters og teltpladser i statsskov, som er gratis at bruge. Andre er herberger og lejrpladser med en mindre betaling.",
      },
      {
        question: "Skal man booke shelters på Hærvejen?",
        answer:
          "De fleste primitive pladser er først-til-mølle. I højsæsonen (juni-august) kan det være svært at finde plads på de mest populære strækninger, så overvej at booke hvor det er muligt, eller medbring telt som alternativ.",
      },
    ],
  },
  gudenaaen: {
    key: "gudenaaen",
    slug: "gudenaaen",
    h1: "Shelters ved Gudenåen",
    titleTemplate: (n) => `Shelter ved Gudenåen – ${n} pladser | ShelterDK`,
    description: (n) =>
      `${n} shelters og lejrpladser ved Gudenåen. Overnat langs Danmarks længste å – ideelt til kano, kajak og vandreture.`,
    intro: (n) =>
      `Gudenåen er Danmarks længste vandløb og løber 160 km fra Tinnet Krat til Randers Fjord. Åen er et af landets mest populære kano- og kajakområder, og langs ruten ligger en række shelters og lejrpladser med bådebro eller nem adgang til vandet. Her er ${n} overnatningssteder ved åen.`,
    faq: [
      {
        question: "Kan man sejle i kano på Gudenåen og overnate undervejs?",
        answer:
          "Ja. Gudenåen er en af Danmarks bedste kanoruter, og der ligger lejrpladser med bådebro langs store dele af strækningen. Flere steder kræver det en kanotilladelse, og overnatning skal typisk bookes i forvejen i højsæsonen.",
      },
      {
        question: "Er der gratis shelters ved Gudenåen?",
        answer:
          "Nogle af pladserne er gratis primitive shelters, mens de officielle kanolejrpladser typisk koster et mindre beløb per person per nat. Prisen fremgår af den enkelte plads.",
      },
      {
        question: "Hvor starter og slutter Gudenåstien?",
        answer:
          "Gudenåstien følger åen fra Tinnet Krat ved kilden til Randers, cirka 175 km. Den kan gås i etaper, og mange kombinerer vandring med overnatning i shelters undervejs.",
      },
    ],
  },
};
