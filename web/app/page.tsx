import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { FrontPageShelterGrid } from "@/components/FrontPageShelterGrid";
import { SearchBar } from "@/components/SearchBar";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { isShelterPlace } from "@/lib/shelter-detail";

export const dynamic = "force-dynamic";

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
  {
    name: "Øerne",
    href: "/soeg?region=Øerne",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80&auto=format&fit=crop",
  },
];

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, geofa_raw";
const SHELTER_SELECT_FALLBACK =
  "id, title, slug, description, location, image_url, google_rating, google_user_ratings_total, google_place_name, booking_url, duplicate_of_shelter_id, region, geofa_raw";

/** Domæner vi tillider for forsidens billeder (samme som next.config images). Udelad shelters med image_url fra andre domæner. */
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
  unstable_noStore();
  try {
    const supabase = createPublicClient();
    const base = (select: string) =>
      supabase
        .from("shelters")
        .select(select)
        .is("duplicate_of_shelter_id", null)
        .order("title", { ascending: true })
        .limit(limit * 10);

    let list: Shelter[] = [];
    const { data: withImage, error: err1 } = await base(SHELTER_SELECT)
      .not("image_url", "is", null)
      .neq("image_url", "");

    if (!err1 && withImage && withImage.length > 0) {
      list = (withImage as Shelter[]) ?? [];
      if (list.length > 0 && process.env.NODE_ENV === "development") {
        const first = list[0] as Record<string, unknown>;
        console.log("[shelters] first row kommune:", first?.kommune ?? "(missing)");
      }
    } else {
      const { data, error } = await base(SHELTER_SELECT)
        .not("image_url", "is", null)
        .neq("image_url", "");
      if (!error && data) list = (data as Shelter[]) ?? [];
      else if (error?.code === "42703") {
        if (process.env.NODE_ENV === "development")
          console.warn("[shelters] kommune column missing (42703), using fallback select");
        const { data: fallbackData } = await base(SHELTER_SELECT_FALLBACK)
          .not("image_url", "is", null)
          .neq("image_url", "");
        if (fallbackData?.length) list = fallbackData as Shelter[];
        else {
          const { data: d } = await base(SHELTER_SELECT_FALLBACK)
            .not("image_url", "is", null)
            .neq("image_url", "");
          if (d?.length) list = d as Shelter[];
        }
      } else if (error) console.error("Supabase error:", error);
    }
    // Forsiden: kun shelters med billede fra tillidte domæner
    list = list.filter(
      (s) => (s.image_url ?? "").trim() !== "" && isAllowedImageUrl(s.image_url)
    );
    const hasImageAndReviews = (s: Shelter) =>
      isShelterPlace(s.google_place_name ?? null) &&
      ((s.google_user_ratings_total ?? 0) > 0 || s.google_rating != null);
    // Forsiden viser KUN shelters der har BÅDE billede OG anmeldelser
    list = list.filter(hasImageAndReviews);
    const sorted = [...list].sort((a, b) => {
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

const FRONT_PAGE_SHELTER_LIMIT = 12;
const FRONT_PAGE_FETCH_BUFFER = 24; // Kun shelters med billede+anmeldelser; buffer til at erstatte defekte billeder

export default async function HomePage() {
  const shelters = await getPrimaryShelters(FRONT_PAGE_FETCH_BUFFER);

  return (
    <>
      <section className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white min-h-[420px] flex flex-col justify-end">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1920&q=80&auto=format&fit=crop')] bg-cover bg-center opacity-25" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 w-full">
          <div className="max-w-3xl mb-10">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Find dit næste shelter i Danmark
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8">
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
      </section>

      {shelters.length > 0 && (
        <section className="py-16 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-bold text-primary mb-8 text-center">
              Udforsk shelters
            </h2>
            <FrontPageShelterGrid
              shelters={shelters}
              maxVisible={FRONT_PAGE_SHELTER_LIMIT}
            />
          </div>
        </section>
      )}

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Udforsk efter region
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {regions.map((region) => (
              <Link
                key={region.href + region.name}
                href={region.href}
                className="group relative overflow-hidden rounded-xl aspect-[4/3] bg-primary"
              >
                <Image
                  src={region.image}
                  alt={region.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="font-serif text-2xl font-bold text-white">
                    {region.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
