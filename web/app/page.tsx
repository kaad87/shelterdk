import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { WebSiteSchema } from "@/components/seo/WebSiteSchema";
import { FrontPageShelterGrid } from "@/components/FrontPageShelterGrid";
import { SearchBar } from "@/components/SearchBar";
import { createPublicClient } from "@/utils/supabase/server-public";

const MapComponent = dynamic(
  () => import("@/components/MapComponent").then((m) => ({ default: m.MapComponent })),
  { ssr: false }
);
import type { Shelter } from "@/types/shelter";
import { isShelterPlace } from "@/lib/shelter-detail";

export const revalidate = 86400; // ISR: cache og revalider forsiden hver 24. time (hurtig TTFB)

const FRONT_PAGE_SHELTER_LIMIT = 4;
const FRONT_PAGE_FETCH_BUFFER = 24;

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, geofa_raw, display_score";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, geofa_raw";

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
    return sorted.slice(0, limit);
  } catch (err) {
    console.error("Error fetching shelters:", err);
    return [];
  }
}

export const metadata: Metadata = {
  title: "ShelterDK – Find dit næste shelter",
  description:
    "Udforsk shelters i hele Danmark. Find overnatningspladser i naturen med kort, billeder og anmeldelser.",
};

const regions = [
  {
    name: "Jylland",
    href: "/soeg?region=Jylland",
    image:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80&auto=format&fit=crop",
  },
  {
    name: "Sjælland",
    href: "/soeg?region=Sjælland",
    image:
      "https://images.unsplash.com/photo-1562843025-6e9c7260b005?w=800&q=80&auto=format&fit=crop",
  },
  {
    name: "Fyn",
    href: "/soeg?region=Fyn",
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
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "lolland",
    name: "Lolland",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "soehojlandet",
    name: "Silkeborg & Søhøjlandet",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "kongernes-nordsjaelland",
    name: "Kongernes Nordsjælland",
    image:
      "https://images.unsplash.com/photo-1511497584788-876760111969?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "bornholm",
    name: "Bornholm",
    image:
      "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80&auto=format&fit=crop",
  },
  {
    slug: "nationalpark-thy",
    name: "Nationalpark Thy",
    image:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80&auto=format&fit=crop",
  },
];

export default async function HomePage() {
  let shelters: Shelter[] = [];
  try {
    shelters = await getPrimaryShelters(FRONT_PAGE_FETCH_BUFFER);
  } catch (err) {
    console.error("Forside: kunne ikke hente shelters:", err);
  }
  // Initiale markers på kortet (samme top-shelters som grid); ved pan/zoom hentes viewport-data via API
  const mapShelters = shelters.slice(0, 100);

  return (
    <>
      <WebSiteSchema />
      {/* Semantisk: side-intro med én h1 – godt for SEO og skærmlæsere */}
      <header
        className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white min-h-[320px] sm:min-h-[380px] md:min-h-[420px] flex flex-col justify-end"
        aria-label="Introduktion"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1920&q=80&auto=format&fit=crop')] bg-cover bg-center opacity-25" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 w-full">
          <div className="max-w-3xl mb-10">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Find dit næste shelter i Danmark
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8">
              Udforsk Danmarks shelters – ét samlet kort over naturovernatning fra
              Geofa, Naturstyrelsen, Book en Shelter og flere.
            </p>
          </div>
          <div className="max-w-4xl">
            <Suspense fallback={<div className="h-14 bg-white/20 rounded-xl animate-pulse" />}>
              <SearchBar mode="home" className="w-full" />
            </Suspense>
          </div>
        </div>
      </header>

      {shelters.length > 0 && (
        <section
          className="py-16 bg-background"
          id="udforsk-shelters"
          aria-labelledby="heading-udforsk-shelters"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="heading-udforsk-shelters" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
              Udforsk shelters
            </h2>
            <FrontPageShelterGrid
              shelters={shelters}
              maxVisible={FRONT_PAGE_SHELTER_LIMIT}
            />
          </div>
        </section>
      )}

      <section
        className="pt-8 pb-16 bg-background"
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
        className="py-16 bg-background"
        id="udforsk-efter-region"
        aria-labelledby="heading-region"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="heading-region" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Udforsk efter region
          </h2>
          <nav aria-label="Udforsk shelters efter region">
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none m-0 p-0">
              {regions.map((region) => (
                <li key={region.href + region.name}>
                  <Link
                    href={region.href}
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] bg-primary block"
                  >
                    <Image
                      src={region.image}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      priority
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
        className="py-16 bg-background"
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
                      alt=""
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
