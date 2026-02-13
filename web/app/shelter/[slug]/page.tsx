import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  MapPin,
  Star,
  Users,
  Building2,
  Mail,
  Calendar,
  Check,
  Quote,
} from "lucide-react";
import { createPublicClient } from "@/utils/supabase/server-public";
import { ShelterGallery } from "@/components/ShelterGallery";
import { ShelterLocationMap } from "@/components/ShelterLocationMap";
import { ShelterFaq } from "@/components/ShelterFaq";
import { getShelterFaqItems, faqToJsonLd } from "@/lib/faq";
import type { Metadata } from "next";
import type { Shelter } from "@/types/shelter";
import {
  getLongDescription,
  getPhotoUrls,
  getCapacity,
  getFeatures,
  getSeason,
  getOwner,
  getContact,
  getAccessDescription,
  getLocationCoords,
  getCity,
  isShelterPlace,
  stripHtml,
  isBookable,
  getToilet,
  getPetsAllowed,
} from "@/lib/shelter-detail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const SHELTER_SELECT_DETAIL =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, region, kommune, place, toilet, geofa_raw";
const SHELTER_SELECT_DETAIL_FALLBACK =
  "id, title, slug, description, location, image_url, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, region, geofa_raw";

async function getShelterBySlug(slug: string): Promise<Shelter | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT_DETAIL)
    .eq("slug", slug)
    .single();
  if (!error && data) return data as Shelter;
  if (error?.code === "42703") {
    const { data: fallback } = await supabase
      .from("shelters")
      .select(SHELTER_SELECT_DETAIL_FALLBACK)
      .eq("slug", slug)
      .single();
    if (fallback) return fallback as Shelter;
  }
  return null;
}

async function getReviews(googlePlaceId: string | null) {
  if (!googlePlaceId) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("google_place_reviews")
    .select("author_name, rating, text, relative_time_description")
    .eq("google_place_id", googlePlaceId)
    .order("time", { ascending: false })
    .limit(5);
  return (data || []) as {
    author_name: string | null;
    rating: number | null;
    text: string | null;
    relative_time_description: string | null;
  }[];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const shelter = await getShelterBySlug(slug);
  if (!shelter) return { title: "Shelter ikke fundet" };

  const longDesc = getLongDescription(shelter);
  const fallbackDesc = stripHtml(shelter.description)?.slice(0, 160) || null;
  const description =
    longDesc?.slice(0, 160) ||
    fallbackDesc ||
    `Shelter: ${shelter.title}. Overnatning i naturen i Danmark.`;

  return {
    title: `${shelter.title} | ShelterDK`,
    description,
    openGraph: {
      title: `${shelter.title} | ShelterDK`,
      description,
      siteName: "ShelterDK",
    },
  };
}

export default async function ShelterPage({ params }: PageProps) {
  const { slug } = await params;
  const shelter = await getShelterBySlug(slug);

  if (!shelter) notFound();

  const [reviews] = await Promise.all([
    getReviews(shelter.google_place_id ?? null),
  ]);

  const placeName = shelter.google_place_name ?? null;
  const showReviews = isShelterPlace(placeName);
  const city =
    getCity(shelter) ??
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const photoUrls = getPhotoUrls(shelter);
  // Kun rigtige billed-URL'er – ingen billede → tom array, så galleriet viser "Ingen billede"-placeholder
  const allPhotoUrls = photoUrls.length > 0 ? photoUrls : [];
  const displayDescription =
    getLongDescription(shelter) || stripHtml(shelter.description) || null;
  const capacity = getCapacity(shelter);
  const features = getFeatures(shelter);
  const season = getSeason(shelter);
  const owner = getOwner(shelter);
  const contact = getContact(shelter);
  const accessDesc = getAccessDescription(shelter);
  const coords = getLocationCoords(shelter);
  const mapUrl = coords
    ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=15/${coords.lat}/${coords.lon}`
    : null;
  const googleMapsUrl = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lon}`
    : shelter.google_place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shelter.title)}&query_place_id=${encodeURIComponent(shelter.google_place_id)}`
      : null;
  // Brug kun eksterne booking-links (http/https). Relative URL'er ville ellers bare genindlæse sheltersiden.
  const rawBookingUrl = shelter.booking_url?.trim() || null;
  const bookingUrl =
    rawBookingUrl && /^https?:\/\//i.test(rawBookingUrl) ? rawBookingUrl : null;

  const toilet = getToilet(shelter);
  const petsAllowed = getPetsAllowed(shelter);
  const shelterFaqItems = getShelterFaqItems(shelter.title, {
    toilet,
    bookable: isBookable(shelter),
    bookingUrl,
    petsAllowed,
  });
  const shelterFaqJsonLd =
    shelterFaqItems.length > 0
      ? JSON.stringify(faqToJsonLd(shelterFaqItems))
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Breadcrumb – Landfolk-style */}
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-primary/70">
          <Link href="/" className="hover:text-accent transition-colors">
            Hjem
          </Link>
          <span aria-hidden className="text-primary/50">
            /
          </span>
          <Link href="/soeg" className="hover:text-accent transition-colors">
            Søg shelters
          </Link>
          {city && (
            <>
              <span aria-hidden className="text-primary/50">/</span>
              <span className="text-primary/90">{city}</span>
            </>
          )}
          <span aria-hidden className="text-primary/50">/</span>
          <span className="text-primary font-medium truncate max-w-[200px] sm:max-w-none">
            {shelter.title}
          </span>
        </nav>

        <div className="lg:grid lg:grid-cols-[1fr,340px] lg:gap-10 lg:items-start">
          <article className="min-w-0">
            {/* Hero + galleri */}
            <ShelterGallery
              urls={allPhotoUrls}
              title={shelter.title}
              rating={showReviews ? shelter.google_rating : null}
              ratingsTotal={showReviews ? shelter.google_user_ratings_total : null}
              region={city}
              slug={slug}
              shelterId={shelter.id}
            />

            {/* Quick facts – icon + label (Landfolk/Airbnb) */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 mb-8 text-primary/90">
              {city && (
                <span className="flex items-center gap-2">
                  <MapPin size={18} className="text-accent shrink-0" />
                  {city}
                </span>
              )}
              {capacity != null && (
                <span className="flex items-center gap-2">
                  <Users size={18} className="text-accent shrink-0" />
                  {capacity} pladser
                </span>
              )}
              {showReviews && shelter.google_rating != null && (
                <span className="flex items-center gap-2">
                  <Star size={18} className="fill-accent text-accent shrink-0" />
                  {shelter.google_rating.toFixed(1)}
                  {shelter.google_user_ratings_total != null && (
                    <span className="text-primary/70">
                      ({shelter.google_user_ratings_total} anmeldelser)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Faciliteter – grid af chips */}
            {features.length > 0 && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Faciliteter
                </h2>
                <div className="flex flex-wrap gap-2">
                  {features.map((f, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary"
                    >
                      <Check size={16} className="text-accent shrink-0" />
                      <span>
                        {f.label}
                        {f.value != null && f.value !== "" && (
                          <span className="text-primary/80"> · {f.value}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Beskrivelse */}
            {displayDescription && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Om dette shelter
                </h2>
                <p className="text-primary/90 whitespace-pre-line leading-relaxed">
                  {displayDescription}
                </p>
              </section>
            )}

            {/* Tilgængelighed (parkering, belægning) */}
            {accessDesc && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Tilgængelighed
                </h2>
                <p className="text-primary/90 whitespace-pre-line leading-relaxed">
                  {accessDesc}
                </p>
              </section>
            )}

            {/* Google-anmeldelser – vis kun når det matchede sted er shelteret selv */}
            {showReviews && reviews.length > 0 && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Anmeldelser
                </h2>
                <ul className="space-y-6">
                  {reviews.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-primary/10 bg-white/50 p-5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {r.rating != null && (
                          <span className="flex items-center gap-1 text-accent">
                            <Star size={16} className="fill-current" />
                            {r.rating.toFixed(1)}
                          </span>
                        )}
                        {r.author_name && (
                          <span className="font-medium text-primary">
                            {r.author_name}
                          </span>
                        )}
                        {r.relative_time_description && (
                          <span className="text-primary/60 text-sm">
                            · {r.relative_time_description}
                          </span>
                        )}
                      </div>
                      {r.text && (
                        <p className="text-primary/90 text-sm leading-relaxed flex gap-2">
                          <Quote size={16} className="text-accent/60 shrink-0 mt-0.5" />
                          {r.text}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {shelter.google_place_id && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shelter.title)}&query_place_id=${encodeURIComponent(shelter.google_place_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-accent hover:underline text-sm font-medium"
                  >
                    Se alle anmeldelser på Google
                    <ExternalLink size={14} />
                  </a>
                )}
              </section>
            )}

            {/* FAQ – Q&A format for SEO / Perplexity / ChatGPT */}
            <ShelterFaq
              items={shelterFaqItems}
              jsonLd={shelterFaqJsonLd}
            />

            {/* Kort */}
            {coords && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Beliggenhed
                </h2>
                <ShelterLocationMap
                  lat={coords.lat}
                  lon={coords.lon}
                  openStreetMapUrl={mapUrl!}
                  googleMapsUrl={googleMapsUrl}
                />
              </section>
            )}
          </article>

          {/* Sticky sidebar – booking, kontaktoplysninger, rating */}
          <aside className="lg:sticky lg:top-6 mt-8 lg:mt-0 space-y-4">
            <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-6">
              {bookingUrl ? (
                <>
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-accent text-white font-semibold px-6 py-4 rounded-xl hover:bg-accent/90 transition-colors"
                  >
                    <ExternalLink size={20} />
                    Book shelter
                  </a>
                  <p className="text-center text-primary/70 text-sm mt-3">
                    Du sendes til booking-systemet
                  </p>
                </>
              ) : isBookable(shelter) ? (
                <p className="text-primary/80 text-center py-2">
                  Shelteren kan ofte bookes på{" "}
                  <a
                    href="https://udinaturen.dk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline hover:no-underline"
                  >
                    udinaturen.dk
                  </a>
                  .
                </p>
              ) : (
                <p className="text-primary/80 text-center py-2">
                  Bookning er ikke tilgængelig for dette shelter.
                </p>
              )}
              {showReviews && shelter.google_rating != null && (
                <div className="mt-4 pt-4 border-t border-primary/10 flex items-center justify-center gap-2 text-primary/90">
                  <Star size={18} className="fill-accent text-accent" />
                  <span className="font-medium">{shelter.google_rating.toFixed(1)}</span>
                  {shelter.google_user_ratings_total != null && (
                    <span className="text-primary/70">
                      ({shelter.google_user_ratings_total} anmeldelser)
                    </span>
                  )}
                </div>
              )}
            </div>

            {(owner || contact || season) && (
              <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-6">
                <h2 className="font-serif text-lg font-bold text-primary mb-3">
                  Kontaktoplysninger
                </h2>
                <ul className="space-y-2.5 text-primary/90 text-sm">
                  {owner && (
                    <li className="flex items-start gap-2">
                      <Building2 size={18} className="text-accent shrink-0 mt-0.5" />
                      <span><strong className="text-primary">Ansvarlig:</strong> {owner}</span>
                    </li>
                  )}
                  {contact && (
                    <li className="flex items-start gap-2">
                      <Mail size={18} className="text-accent shrink-0 mt-0.5" />
                      <span className="break-all"><strong className="text-primary">Kontakt:</strong> {contact}</span>
                    </li>
                  )}
                  {season && (
                    <li className="flex items-start gap-2">
                      <Calendar size={18} className="text-accent shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-primary">Sæson:</strong> {season.label}
                        {season.note && ` – ${season.note}`}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
