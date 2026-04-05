import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { WebSiteSchema } from "@/components/seo/WebSiteSchema";
import { FrontPageShelterGrid } from "@/components/FrontPageShelterGrid";
import { SearchBar } from "@/components/SearchBar";
import { MobileHomePills } from "@/components/MobileHomePills";
import { createPublicClient } from "@/utils/supabase/server-public";
import { enrichSheltersWithGooglePhotoRef } from "@/lib/google-photo";

const InstagramFeed = dynamic(
  () => import("@/components/InstagramFeed").then((m) => ({ default: m.InstagramFeed })),
  { ssr: false }
);

const NewsletterSignup = dynamic(
  () => import("@/components/NewsletterSignup"),
  { ssr: false }
);

const MapComponent = dynamic(
  () => import("@/components/MapComponent").then((m) => ({ default: m.MapComponent })),
  { ssr: false }
);
import type { Shelter } from "@/types/shelter";
import { isShelterPlace } from "@/lib/shelter-detail";

export const revalidate = 86400; // ISR: cache og revalider forsiden hver 24. time (hurtig TTFB)

const FRONT_PAGE_SHELTER_LIMIT = 8; // antal kort i grid'et
const FRONT_PAGE_MAP_SHELTER_LIMIT = 40; // antal shelters til initiale pins på kortet

/** Udvalgte shelters på forsiden (i denne rækkefølge). */
const FEATURED_SHELTER_SLUGS = [
  "shelter-og-stjernekiggertarn-ved-slaggardbanke-97136",
  "shelter-i-true-skov-10055",
  "logismose-10073",
  "tipi-og-shelters-i-frugtplantagen-11780",
  "shelter-ved-nors-so-10056",
  "shelter-i-hovdal-10049",
  "kongshoj-strand-10809",
  "hojagers-shelter-11932",
  "bindeballe-kobmandsgard-2-sheltere-92598",
  "ronnerhavnen-10535",
] as const;

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, display_score, google_places!shelters_google_place_id_fkey(photo_references)";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, display_score, google_places!shelters_google_place_id_fkey(photo_references)";

const ALLOWED_IMAGE_HOSTS = new Set([
  "dynamic-media-cdn.tripadvisor.com",
  "cdn.campanyon.com",
  "media.glampinghub.com",
  "images.unsplash.com",
  "placehold.co",
  "lh3.googleusercontent.com",
  "unsplash.com",
  "mapcentia-www.s3-eu-west-1.amazonaws.com",
]);

function isAllowedImageUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  if (!u || !u.startsWith("http")) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return ALLOWED_IMAGE_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** Henter de fire udvalgte forsideshelters i fast rækkefølge. */
async function getFeaturedShelters(): Promise<Shelter[]> {
  try {
    const supabase = createPublicClient();
    const slugs = [...FEATURED_SHELTER_SLUGS];
    const { data, error } = await supabase
      .from("shelters")
      .select(SHELTER_SELECT)
      .is("duplicate_of_shelter_id", null)
      .in("slug", slugs);

    if (error) {
      if (error.code === "42703") {
        const { data: fallback } = await supabase
          .from("shelters")
          .select(SHELTER_SELECT_FALLBACK)
          .is("duplicate_of_shelter_id", null)
          .in("slug", slugs);
        if (!fallback?.length) return [];
        const bySlug = new Map((fallback as unknown as Shelter[]).map((s) => [s.slug, s]));
        const list = slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as Shelter[];
        return enrichSheltersWithGooglePhotoRef(list);
      }
      console.error("Supabase featured shelters:", error);
      return [];
    }
    const list = (data as unknown as Shelter[]) ?? [];
    const bySlug = new Map(list.map((s) => [s.slug, s]));
    const ordered = slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as Shelter[];
    return enrichSheltersWithGooglePhotoRef(ordered);
  } catch (err) {
    console.error("Error fetching featured shelters:", err);
    return [];
  }
}

async function getPrimaryShelters(limit: number): Promise<Shelter[]> {
  try {
    const supabase = createPublicClient();
    const base = (select: string) =>
      supabase
        .from("shelters")
        .select(select)
        .is("duplicate_of_shelter_id", null)
        .order("display_score", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true })
        .limit(limit * 10);

    let list: Shelter[] = [];
    const { data: withImage, error: err1 } = await base(SHELTER_SELECT)
      .not("image_url", "is", null)
      .neq("image_url", "");

    if (!err1 && withImage && withImage.length > 0) {
      list = (withImage as unknown as Shelter[]) ?? [];
    } else {
      const { data, error } = await base(SHELTER_SELECT)
        .not("image_url", "is", null)
        .neq("image_url", "");
      if (!error && data) list = (data as unknown as Shelter[]) ?? [];
      else if (error?.code === "42703") {
        const { data: fallbackData } = await base(SHELTER_SELECT_FALLBACK)
          .not("image_url", "is", null)
          .neq("image_url", "");
        if (fallbackData?.length) list = fallbackData as unknown as Shelter[];
        else {
          const { data: d } = await base(SHELTER_SELECT_FALLBACK)
            .not("image_url", "is", null)
            .neq("image_url", "");
          if (d?.length) list = d as unknown as Shelter[];
        }
      } else if (error) console.error("Supabase error:", error);
    }
    list = list.filter(
      (s) => (s.image_url ?? "").trim() !== "" && isAllowedImageUrl(s.image_url)
    );
    const hasImageAndReviews = (s: Shelter) =>
      isShelterPlace(s.google_place_name ?? null) &&
      ((s.google_user_ratings_total ?? 0) > 0 || s.google_rating != null);
    list = list.filter(hasImageAndReviews);
    const sorted = [...list].sort((a, b) => {
      const aScore = a.display_score ?? 0;
      const bScore = b.display_score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      const aTotal = a.google_user_ratings_total ?? 0;
      const bTotal = b.google_user_ratings_total ?? 0;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return (a.title || "").localeCompare(b.title || "");
    });
    return enrichSheltersWithGooglePhotoRef(sorted.slice(0, limit));
  } catch (err) {
    console.error("Error fetching shelters:", err);
    return [];
  }
}

export const metadata: Metadata = {
  title: { absolute: "ShelterDK – Find dit næste shelter i Danmark" },
  description:
    "Udforsk shelters i hele Danmark. Find overnatningspladser i naturen med kort, billeder og anmeldelser.",
  alternates: { canonical: "https://shelterdk.dk/" },
  openGraph: {
    title: "ShelterDK – Find dit næste shelter i Danmark",
    description: "Udforsk shelters i hele Danmark. Find overnatningspladser i naturen med kort, billeder og anmeldelser.",
    url: "/",
  },
};

const regions = [
  {
    name: "Jylland",
    href: "/danmark/jylland",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80&auto=format&fit=crop",
  },
  {
    name: "Sjælland",
    href: "/danmark/sjaelland",
    image:
      "https://images.unsplash.com/photo-1562843025-6e9c7260b005?w=800&q=80&auto=format&fit=crop",
  },
  {
    name: "Fyn",
    href: "/danmark/fyn",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80&auto=format&fit=crop",
  },
];

/** Populære områder til forside – styrker intern linking til /omraade/[slug]. */
const POPULAR_AREAS = [
  {
    slug: "sydfynske-oeehav",
    name: "Sydfynske Øhav",
    image:
      "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "lolland",
    name: "Lolland",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "soehojlandet",
    name: "Silkeborg og Søhøjlandet",
    image:
      "https://images.unsplash.com/photo-1713872489154-cabdd362a855?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "kongernes-nordsjaelland",
    name: "Kongernes Nordsjælland",
    image:
      "https://images.unsplash.com/photo-1733498669242-ab73bd57ccdf?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "bornholm",
    name: "Bornholm",
    image:
      "https://images.unsplash.com/photo-1636151634125-1a0e9fa99792?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "nationalpark-thy",
    name: "Nationalpark Thy",
    image:
      "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?w=800&q=80&auto=format&fit=crop",
  },
];

export default async function HomePage() {
  let featuredShelters: Shelter[] = [];
  try {
    featuredShelters = await getFeaturedShelters();
  } catch (err) {
    console.error("Forside: kunne ikke hente udvalgte shelters:", err);
  }
  // Forside-grid: de udvalgte shelters.
  // Kortet må gerne have flere pins fra start, så man ser et mere fyldigt Danmarkskort.
  let mapShelters: Shelter[] = featuredShelters;
  try {
    const primaryForMap = await getPrimaryShelters(FRONT_PAGE_MAP_SHELTER_LIMIT);
    if (primaryForMap.length > 0) {
      mapShelters = primaryForMap;
    }
  } catch (err) {
    console.error("Forside: kunne ikke hente shelters til kortet:", err);
  }

  // Get total shelter count for hero trust counter
  let shelterCount = 800;
  try {
    const supabase = createPublicClient();
    const { count } = await supabase
      .from("shelters")
      .select("id", { count: "exact", head: true })
      .is("duplicate_of_shelter_id", null);
    if (count && count > 0) shelterCount = Math.round(count / 100) * 100;
  } catch {
    // Use fallback
  }

  return (
    <>
      <WebSiteSchema />
      {/* ===== MOBILE HERO (< md) ===== */}
      <header
        className="md:hidden bg-gradient-to-br from-[#2c3e2d] to-[#1a2b1a] text-white px-4 pt-14 pb-6"
        aria-label="Introduktion"
      >
        <h1 className="font-serif text-2xl font-bold mb-3">
          Find dit næste shelter
        </h1>
        <Link
          href="/soeg"
          className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-primary/50 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary/40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span>Søg by, område eller shelter…</span>
        </Link>
      </header>

      {/* ===== DESKTOP HERO (md+) ===== */}
      <header
        className="hidden md:flex relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white min-h-[420px] flex-col justify-end"
        aria-label="Introduktion"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&auto=format&fit=crop')] bg-cover bg-center opacity-25" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 w-full">
          <div className="max-w-3xl mb-10">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Find dit næste shelter i Danmark
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/90 mb-4">
              Udforsk Danmarks shelters – ét samlet kort over naturovernatning fra
              Geodatastyrelsen, Naturstyrelsen og kommunale kilder.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-white/70 text-sm mb-4">
              <span><strong className="text-white">{shelterCount}+</strong> shelters</span>
              <span><strong className="text-white">Gratis</strong> at bruge</span>
            </div>
          </div>
          <div className="max-w-4xl">
            <Suspense fallback={<div className="h-14 bg-white/20 rounded-xl animate-pulse" />}>
              <SearchBar mode="home" className="w-full" />
            </Suspense>
          </div>
        </div>
      </header>

      {/* ===== MOBILE PILLS (< md) ===== */}
      <MobileHomePills />

      {/* ===== DESKTOP: Redaktionel intro + pills (md+) ===== */}
      <section className="hidden md:block pt-8 pb-4 bg-background" aria-labelledby="heading-intro">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-primary/70 text-sm sm:text-base leading-relaxed text-center max-w-2xl mx-auto">
            ShelterDK samler {shelterCount}+ shelters fra Geodatastyrelsen,
            Naturstyrelsen og kommunale kilder på ét kort – med billeder,
            anmeldelser, faciliteter og vejrudsigt.
          </p>
          <nav
            className="mt-4 flex flex-wrap justify-center gap-2"
            aria-label="Hurtige links"
          >
            <Link
              href="/soeg?bookbar=1"
              className="rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              Bookbare shelters
            </Link>
            <Link
              href="/shelter-med-toilet"
              className="rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
            >
              Med toilet
            </Link>
            <Link
              href="/shelter-med-vand"
              className="rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
            >
              Med vand
            </Link>
            <Link
              href="/shelter-med-hund"
              className="rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
            >
              Hundevenlige
            </Link>
            <Link
              href="/shelter-med-baalplads"
              className="rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
            >
              Med bålplads
            </Link>
            <Link
              href="/guides"
              className="rounded-full border border-primary/15 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
            >
              Guides
            </Link>
          </nav>
        </div>
      </section>

      {featuredShelters.length > 0 && (
        <section
          className="pt-8 pb-6 bg-background"
          id="udforsk-shelters"
          aria-labelledby="heading-udforsk-shelters"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="heading-udforsk-shelters" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
              <span className="md:hidden">Populære shelters</span>
              <span className="hidden md:inline">Udforsk shelters</span>
            </h2>
            <FrontPageShelterGrid
              shelters={featuredShelters}
              maxVisible={FRONT_PAGE_SHELTER_LIMIT}
            />
          </div>
        </section>
      )}

      {/* ===== MOBILE REGION GRID (< md) ===== */}
      <section className="md:hidden py-6 bg-background" aria-labelledby="heading-region-mobile">
        <div className="mx-auto px-4">
          <h2 id="heading-region-mobile" className="font-serif text-xl font-bold text-primary mb-4">
            Udforsk efter område
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Jylland", href: "/danmark/jylland", count: "700+", gradient: "from-[#2c3e2d] to-[#4a6b4a]" },
              { name: "Sjælland", href: "/danmark/sjaelland", count: "500+", gradient: "from-[#2b3a5e] to-[#4a6b8a]" },
              { name: "Fyn", href: "/danmark/fyn", count: "250+", gradient: "from-[#5e4a2b] to-[#8a7b4a]" },
              { name: "Bornholm", href: "/danmark/bornholm", count: "30+", gradient: "from-[#4a2b5e] to-[#6b4a8a]" },
            ].map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className={`rounded-xl bg-gradient-to-br ${r.gradient} p-4 text-white active:scale-[0.97] transition-transform touch-manipulation`}
              >
                <div className="font-serif text-lg font-bold">{r.name}</div>
                <div className="text-sm text-white/70">{r.count} shelters</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        className="pt-4 pb-8 bg-background"
        id="kort"
        aria-labelledby="heading-kort"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="heading-kort" className="font-serif text-3xl font-bold text-primary mb-4 text-center">
            Kort over Danmarks shelters
          </h2>
          <figure className="rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[320px] sm:min-h-[400px] md:min-h-[560px] h-[60vh] sm:h-[70vh] md:h-[75vh] max-h-[960px]" aria-label="Interaktivt kort med shelters">
            <MapComponent shelters={mapShelters} className="w-full h-full" />
          </figure>
          <p className="text-center mt-4">
            <Link href="/soeg" className="text-accent font-medium hover:underline">
              Søg shelters med liste og kort →
            </Link>
          </p>
        </div>
      </section>

      <section
        className="py-8 bg-background"
        id="planlaeg-din-tur"
        aria-labelledby="heading-planlaeg"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="heading-planlaeg" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Planlæg din sheltertur
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/ruteplanner"
              className="group rounded-xl border border-primary/10 bg-white p-6 hover:border-accent/30 hover:shadow-md transition-all"
            >
              <h3 className="font-serif text-xl font-bold text-primary mb-2 group-hover:text-accent transition-colors">
                Vandreruter med shelters
              </h3>
              <p className="text-primary/70 text-sm leading-relaxed">
                Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen
              </p>
            </Link>
            <Link
              href="/turvenner"
              className="group rounded-xl border border-primary/10 bg-white p-6 hover:border-accent/30 hover:shadow-md transition-all"
            >
              <h3 className="font-serif text-xl font-bold text-primary mb-2 group-hover:text-accent transition-colors">
                Find turvenner
              </h3>
              <p className="text-primary/70 text-sm leading-relaxed">
                Find en makker til din næste sheltertur
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <NewsletterSignup variant="inline" source="homepage" />
        </div>
      </section>

      <section className="py-8 bg-background" id="instagram" aria-labelledby="heading-instagram">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <InstagramFeed title="Shelter-stemning fra Instagram" limit={6} />
        </div>
      </section>

      <section
        className="hidden md:block pt-4 pb-8 bg-background"
        id="udforsk-efter-region"
        aria-labelledby="heading-region"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="heading-region" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Udforsk efter region
          </h2>
          <nav aria-label="Udforsk shelters efter region">
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none m-0 p-0">
              {regions.map((region, i) => (
                <li key={region.href + region.name}>
                  <Link
                    href={region.href}
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] bg-primary block"
                  >
                    <Image
                      src={region.image}
                      alt={`Shelters i ${region.name}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      priority={i === 0}
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent" aria-hidden />
                    <h3 className="absolute bottom-0 left-0 right-0 p-6 font-serif text-2xl font-bold text-white m-0">
                      {region.name}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <section
        className="hidden md:block py-8 bg-background"
        id="populaere-omraader"
        aria-labelledby="heading-populaere-omraader"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="heading-populaere-omraader" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Populære områder
          </h2>
          <nav aria-label="Udforsk shelters efter område">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
              {POPULAR_AREAS.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={`/omraade/${area.slug}`}
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] bg-primary block"
                  >
                    <Image
                      src={area.image}
                      alt={`Shelters i ${area.name}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent" aria-hidden />
                    <h3 className="absolute bottom-0 left-0 right-0 p-5 font-serif text-xl font-bold text-white m-0">
                      {area.name}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center">
              <Link
                href="/omraade"
                className="text-accent font-medium hover:underline inline-flex items-center gap-1"
              >
                Se alle områder
                <span aria-hidden>→</span>
              </Link>
            </p>
          </nav>
        </div>
      </section>
    </>
  );
}
