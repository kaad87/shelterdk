import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { FrontPageShelterGrid } from "@/components/FrontPageShelterGrid";
import { SearchBar } from "@/components/SearchBar";
import { ShelterMap } from "@/components/ShelterMap";
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { isShelterPlace } from "@/lib/shelter-detail";
import { getSheltersPage } from "@/lib/soeg-db";

export const dynamic = "force-dynamic";

const FRONT_PAGE_MAP_SIZE = 1000;
const FRONT_PAGE_SHELTER_LIMIT = 8;
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
  unstable_noStore();
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

export default async function HomePage() {
  unstable_noStore();
  const [shelters, { shelters: mapShelters }] = await Promise.all([
    getPrimaryShelters(FRONT_PAGE_FETCH_BUFFER),
    getSheltersPage(null, null, 1, FRONT_PAGE_MAP_SIZE),
  ]);

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

      <section className="pt-8 pb-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-primary mb-4 text-center">
            Kort over Danmarks shelters
          </h2>
          <div className="rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[560px] h-[75vh] max-h-[960px]">
            <ShelterMap shelters={mapShelters} className="w-full h-full" />
          </div>
          <p className="text-center mt-4">
            <Link href="/soeg" className="text-accent font-medium hover:underline">
              Søg shelters med liste og kort →
            </Link>
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-primary mb-8 text-center">
            Udforsk efter region
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
