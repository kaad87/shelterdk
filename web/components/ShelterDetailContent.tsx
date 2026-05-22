import Link from "next/link";
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
import { ShelterGallery } from "@/components/ShelterGallery";
import { ShelterLocationMap } from "@/components/ShelterLocationMap";
import { ShelterFaq } from "@/components/ShelterFaq";
import { ShelterFacts } from "@/components/ShelterFacts";
import { ShareButtons } from "@/components/ShareButtons";
import { WeatherWidget } from "@/components/WeatherWidget";
import { ResponsiveShelterAvailabilityPanel } from "@/components/ResponsiveShelterAvailabilityPanel";
import dynamic from "next/dynamic";

// Lazy-load CommunityContributionPanel — it pulls the full @supabase/supabase-js
// (auth + realtime, ~140KB unminified). It sits below the fold and only triggers
// when the user actually scrolls down or interacts with community features.
const CommunityContributionPanel = dynamic(
  () =>
    import("@/components/CommunityContributionPanel").then(
      (m) => m.CommunityContributionPanel
    ),
  { ssr: false, loading: () => null }
);
import { CommunityApprovedSection } from "@/components/CommunityApprovedSection";
import { ShelterExperiencesSection } from "@/components/ShelterExperiencesSection";
import NewsletterSignup from "@/components/NewsletterSignup";
import type { DailyForecast } from "@/lib/weather";
import type { Shelter } from "@/types/shelter";
import type { FaqItem } from "@/lib/faq";
import { formatRelativeTimeDa } from "@/lib/relative-time-da";
import { prepositionForRegionName } from "@/lib/area-db";
import { TrackShelterView } from "@/components/TrackShelterView";
import { TrackedExternalLink } from "@/components/TrackedExternalLink";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";
import { TrackedBookLink } from "@/components/TrackedBookLink";
import { WishlistButton } from "@/components/WishlistButton";

const SHELTER_DK_CVR = "37343080";

export interface BreadcrumbLink {
  label: string;
  href?: string;
}

interface ShelterDetailContentProps {
  shelter: Shelter;
  slug: string;
  breadcrumbs: BreadcrumbLink[];
  city: string | null;
  placeName?: string | null;
  placeSlug?: string | null;
  /** Område til intern linking: "Se alle shelters på/i/ved [område]" */
  areaSlug?: string | null;
  areaName?: string | null;
  /** Forholdsord for området (i/på/ved) */
  areaPreposition?: string;
  /** Bålplads – når data findes. */
  firewood?: boolean | null;
  /** Links til relaterede filterlister (fx shelter-med-toilet, shelter-med-vand). */
  facilityLinks?: { label: string; href: string }[];
  /** Vandreruter der passerer dette shelter (fra reverse index). */
  nearbyRoutes?: { slug: string; name: string; length_km: number; distance_km: number }[];
  showReviews: boolean;
  allPhotoUrls: string[];
  displayDescription: string | null;
  capacity: number | null;
  features: { label: string; value?: string }[];
  season: { label: string; note?: string } | null;
  owner: string | null;
  contact: string | null;
  accessDesc: string | null;
  mapUrl: string | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  bookingUnits?: {
    id: string;
    title: string;
    href: string;
    maxPersons: number;
  }[];
  /** Når bookbar men ingen bookingUrl: 'naturstyrelsen' = link til book.naturstyrelsen.dk. */
  bookingFallbackHint?: "naturstyrelsen" | null;
  isBookable: boolean;
  shelterFaqItems: FaqItem[];
  shelterFaqJsonLd: string | undefined;
  reviews: {
    author_name: string | null;
    rating: number | null;
    text: string | null;
    relative_time_description: string | null;
    time: string | null;
  }[];
  coords: { lat: number; lon: number } | null;
  weatherForecast?: DailyForecast[] | null;
}

export function ShelterDetailContent(props: ShelterDetailContentProps) {
  const {
    shelter,
    slug,
    breadcrumbs,
    city,
    placeName = null,
    placeSlug = null,
    areaSlug = null,
    areaName = null,
    areaPreposition = "i",
    firewood = null,
    facilityLinks = [],
    nearbyRoutes = [],
    showReviews,
    allPhotoUrls,
    displayDescription,
    capacity,
    features,
    season,
    owner,
    contact,
    accessDesc,
    mapUrl,
    googleMapsUrl,
    bookingUrl,
    bookingUnits = [],
    bookingFallbackHint = null,
    isBookable,
    shelterFaqItems,
    shelterFaqJsonLd,
    reviews,
    coords,
    weatherForecast = null,
  } = props;
  const mobileAvailabilityTargetId = `availability-slot-mobile-${slug}`;
  const desktopAvailabilityTargetId = `availability-slot-desktop-${slug}`;
  const hasFlushToilet = features.some((feature) => feature.label === "Toilet");
  const hasMulchToilet = features.some((feature) => feature.label === "Muldtoilet");
  const hasWater = features.some((feature) => feature.label === "Vand");
  const toiletClause = hasFlushToilet
    ? "med vandskyllende toilet"
    : hasMulchToilet
      ? "med muldtoilet"
      : null;
  const waterClause = hasWater
    ? toiletClause
      ? "og adgang til vand"
      : "med adgang til vand"
    : null;
  const definitionTextParts = [
    `${shelter.title} er ${isBookable ? "et bookbart" : "et"} shelter`,
    city ? `i ${city}` : null,
    capacity != null ? `med plads til ${capacity} personer` : null,
    toiletClause,
    waterClause,
    isBookable ? "via ShelterDK eller tilknyttet booking" : "som typisk fungerer efter først-til-mølle-princippet",
  ].filter(Boolean);
  const llmDefinition = `${definitionTextParts.join(" ")}.`;
  const lastVerifiedIso =
    shelter.availability_verified_at ??
    shelter.updated_at ??
    shelter.created_at ??
    null;

  const hasMultipleBookingUnits = bookingUnits.length > 1;
  const showAvailabilityPanel =
    bookingUnits.length === 1 || shelter.availability_provider === "naturstyrelsen";
  const getBookingUnitLabel = (title: string) => {
    const prefixes = [`${shelter.title} – `, `${shelter.title} - `];
    for (const prefix of prefixes) {
      if (title.startsWith(prefix)) return title.slice(prefix.length);
    }
    return title;
  };

  const BookingCard = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-2xl border border-primary/10 bg-white shadow-sm p-6 ${className}`}>
      {hasMultipleBookingUnits ? (
        <>
          <div className="mb-4">
            <h2 className="font-serif text-lg font-bold text-primary">
              Vælg shelter
            </h2>
            <p className="mt-1 text-sm text-primary/70">
              Der er {bookingUnits.length} shelters på pladsen, og de bookes hver for sig.
            </p>
          </div>
          <div className="space-y-2.5">
            {bookingUnits.map((unit) => (
              <TrackedBookLink
                key={unit.id}
                href={unit.href}
                shelterId={shelter.id}
                shelterSlug={slug}
                bookingType="multi_unit"
                position="main_card"
                className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 px-4 py-3 hover:border-accent/40 hover:bg-accent/5 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-primary">{getBookingUnitLabel(unit.title)}</span>
                  <span className="block text-xs text-primary/60">
                    {unit.maxPersons} personer
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-accent">
                  Book
                </span>
              </TrackedBookLink>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/8 bg-primary/[0.03] px-3.5 py-3">
            <span className="text-base leading-none mt-0.5 shrink-0">🔒</span>
            <div>
              <p className="text-xs font-semibold text-primary/70 leading-snug">
                Booking via ShelterDK
              </p>
              <p className="text-xs text-primary/45 leading-relaxed mt-0.5">
                ShelterDK er en dansk platform for shelter-booking. Servicegebyret dækker administration af din booking.{" "}
                <span className="text-primary/60 font-medium">CVR {SHELTER_DK_CVR}</span>
              </p>
            </div>
          </div>
        </>
      ) : bookingUnits.length === 1 ? (
        <>
          <TrackedBookLink
            href={bookingUnits[0].href}
            shelterId={shelter.id}
            shelterSlug={slug}
            bookingType="shelterdk"
            position="main_card"
            className="flex items-center justify-center gap-2 w-full bg-accent text-white font-semibold px-6 py-4 rounded-xl hover:bg-accent/90 transition-colors"
          >
            Book dette shelter
          </TrackedBookLink>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/8 bg-primary/[0.03] px-3.5 py-3">
            <span className="text-base leading-none mt-0.5 shrink-0">🔒</span>
            <div>
              <p className="text-xs font-semibold text-primary/70 leading-snug">
                Booking via ShelterDK
              </p>
              <p className="text-xs text-primary/45 leading-relaxed mt-0.5">
                ShelterDK er en dansk platform for shelter-booking. Servicegebyret dækker administration af din booking.{" "}
                <span className="text-primary/60 font-medium">CVR {SHELTER_DK_CVR}</span>
              </p>
            </div>
          </div>
        </>
      ) : bookingUrl ? (
        <>
          <TrackedExternalLink
            href={bookingUrl}
            eventLabel="Book shelter"
            bookContext={{
              shelterId: shelter.id,
              shelterSlug: slug,
              bookingType: "external",
              position: "main_card",
            }}
            className="flex items-center justify-center gap-2 w-full bg-accent text-white font-semibold px-6 py-4 rounded-xl hover:bg-accent/90 transition-colors"
          >
            <ExternalLink size={20} />
            Book shelter
          </TrackedExternalLink>
          <p className="text-center text-primary/70 text-sm mt-3">
            Du sendes til booking-systemet
          </p>
        </>
      ) : isBookable ? (
        <>
          {bookingFallbackHint === "naturstyrelsen" ? (
            <>
              <a
                href="https://book.naturstyrelsen.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-accent text-white font-semibold px-6 py-4 rounded-xl hover:bg-accent/90 transition-colors"
              >
                <ExternalLink size={20} />
                Book på Naturstyrelsen
              </a>
              <p className="text-center text-primary/60 text-xs mt-3">
                Søg efter &quot;{shelter.title}&quot; på book.naturstyrelsen.dk
              </p>
            </>
          ) : (
            <p className="text-primary/80 text-center py-2">
              Dette shelter kræver booking — se beskrivelsen eller kontakt shelter-ejeren for information.
            </p>
          )}
        </>
      ) : (
        <p className="text-primary/80 text-center py-2">
          Booking er ikke tilgængelig for dette shelter.
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
  );

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <SpeakableSchema
        url={`https://shelterdk.dk/shelter/${slug}`}
        selectors={[".llm-quote"]}
      />
      <TrackShelterView shelterName={shelter.title} shelterId={slug} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <nav aria-label="Brødkrummer" className="mb-6 py-2">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-primary/70">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-primary/50">/</span>}
                {b.href ? (
                  <Link href={b.href} className="py-1 hover:text-accent transition-colors touch-manipulation">
                    {b.label}
                  </Link>
                ) : (
                  <span
                    aria-current="page"
                    className="text-primary font-medium truncate max-w-[200px] sm:max-w-none"
                  >
                    {b.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {areaSlug && areaName && (
          <p className="mb-4 text-sm text-primary/80">
            <Link
              href={`/omraade/${areaSlug}`}
              className="text-accent font-medium hover:underline"
            >
              Se alle shelters {areaPreposition} {areaName} →
            </Link>
          </p>
        )}

        <div className="lg:grid lg:grid-cols-[1fr,340px] lg:gap-10 lg:items-start">
          <article aria-labelledby="shelter-title" className="min-w-0">
            <header className="mb-8">
              <ShelterGallery
                urls={allPhotoUrls}
                title={shelter.title}
                rating={showReviews ? shelter.google_rating : null}
                ratingsTotal={showReviews ? shelter.google_user_ratings_total : null}
                region={city}
                slug={slug}
                shelterId={shelter.id}
                blurDataUrl={shelter.blur_data_url ?? undefined}
                headingId="shelter-title"
              />

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-primary/90">
                {city && (
                  <span className="flex items-center gap-2">
                    <MapPin size={18} className="text-accent shrink-0" />
                    {placeName && placeSlug ? (
                      <Link href={`/by/${placeSlug}`} className="text-accent hover:underline">
                        {city}
                      </Link>
                    ) : (
                      city
                    )}
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
                <span className="ml-auto flex items-center gap-2">
                  <WishlistButton
                    slug={slug}
                    title={shelter.title}
                    city={city}
                    imageUrl={shelter.image_url ?? null}
                    variant="labeled"
                  />
                  <ShareButtons title={shelter.title} url={`/shelter/${slug}`} />
                </span>
              </div>
            </header>

            {hasMultipleBookingUnits && (
              <section
                id="booking-enheder"
                aria-labelledby="booking-units-heading"
                className="mb-10 rounded-2xl border border-accent/20 bg-accent/[0.04] p-5"
              >
                <div className="mb-4">
                  <h2
                    id="booking-units-heading"
                    className="font-serif text-xl font-bold text-primary"
                  >
                    Vælg shelter på pladsen
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-primary/80">
                    Shelterpladsen har {bookingUnits.length} separate shelters, som bookes hver for sig.
                    Vælg den enhed, du vil reservere.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {bookingUnits.map((unit) => (
                    <Link
                      key={unit.id}
                      href={unit.href}
                      className="rounded-xl border border-primary/10 bg-white p-4 shadow-sm hover:border-accent/40 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-serif text-lg font-bold text-primary">
                            {getBookingUnitLabel(unit.title)}
                          </h3>
                          <p className="mt-1 text-sm text-primary/65">
                            {unit.maxPersons} personer
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                          Book
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section aria-labelledby="shelter-features-heading" className="mb-10">
                <h2
                  id="shelter-features-heading"
                  className="font-serif text-xl font-bold text-primary mb-4"
                >
                  Faciliteter
                </h2>
                <div className="flex flex-wrap gap-2 mb-4">
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

            <div className="mb-6">
              <CommunityContributionPanel slug={slug} />
              <CommunityApprovedSection slug={slug} />
            </div>

            {facilityLinks.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {facilityLinks.map((fl) => (
                  <Link
                    key={fl.href}
                    href={fl.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 transition-colors"
                  >
                    {fl.label}
                  </Link>
                ))}
              </div>
            )}

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

            <section className="mb-10 rounded-2xl border border-primary/10 bg-primary/[0.03] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-base font-bold text-primary">
                  Kort fortalt
                </h2>
                <LastVerifiedBadge isoDate={lastVerifiedIso} />
              </div>
              <p className="llm-quote mt-3 text-sm leading-7 text-primary/75">
                {llmDefinition}
              </p>
            </section>

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

            {/* Vandreruter nær dette shelter */}
            {nearbyRoutes.length > 0 && (
              <section className="mb-10 bg-accent/[0.04] border border-accent/15 rounded-xl p-5">
                <h2 className="font-serif text-lg font-bold text-primary mb-3">
                  Vandreruter nær dette shelter
                </h2>
                <ul className="space-y-2">
                  {nearbyRoutes.slice(0, 5).map((route) => (
                    <li key={route.slug} className="flex items-center justify-between gap-3">
                      <Link
                        href={`/ruteplanner/${route.slug}`}
                        className="text-sm text-accent hover:underline font-medium min-w-0 truncate"
                      >
                        {route.name}
                      </Link>
                      <span className="text-xs text-primary/40 shrink-0 text-right">
                        <span className="block">{route.length_km} km rute</span>
                        <span className="block">
                          {route.distance_km < 0.1
                            ? "Direkte på ruten"
                            : `${route.distance_km} km herfra`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {nearbyRoutes.length > 5 && (
                  <Link
                    href="/ruteplanner"
                    className="text-xs text-accent hover:underline mt-3 inline-block"
                  >
                    Se alle {nearbyRoutes.length} ruter →
                  </Link>
                )}
              </section>
            )}

            {/* Nyttige ressourcer – intern linking for SEO */}
            <section className="mb-10 bg-primary/[0.03] border border-primary/10 rounded-xl p-5">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Nyttige ressourcer
              </h2>
              <ul className="space-y-2 text-sm text-primary/80">
                {facilityLinks.map((fl) => (
                  <li key={fl.href}>
                    <Link href={fl.href} className="text-accent hover:underline">{fl.label}</Link>
                    {" "}– se alle shelters med denne facilitet
                  </li>
                ))}
                {placeName && placeSlug && (
                  <li>
                    <Link href={`/by/${placeSlug}`} className="text-accent hover:underline">
                      Shelter {placeName}
                    </Link>
                    {" "}– alle shelters i byen
                  </li>
                )}
                {breadcrumbs.length >= 2 && breadcrumbs[1]?.href && breadcrumbs[1].href !== "/soeg" && (
                  <li>
                    <Link href={breadcrumbs[1].href} className="text-accent hover:underline">
                      Shelters {prepositionForRegionName(breadcrumbs[1].label)} {breadcrumbs[1].label}
                    </Link>
                    {" "}– alle shelters {prepositionForRegionName(breadcrumbs[1].label)} regionen
                  </li>
                )}
                <li>
                  <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">
                    Pakkeliste til sheltertur
                  </Link>
                  {" "}– alt du skal medbringe
                </li>
                <li>
                  <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">
                    Regler for shelter og teltning
                  </Link>
                  {" "}– det skal du vide
                </li>
                <li>
                  <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-accent hover:underline">
                    Shelter for begyndere
                  </Link>
                  {" "}– kom godt i gang
                </li>
                <li>
                  <Link href="/blog/gratis-shelters-i-danmark" className="text-accent hover:underline">
                    Gratis shelters i Danmark
                  </Link>
                  {" "}– komplet guide
                </li>
                <li>
                  <Link href="/fakta/shelters-i-danmark" className="text-accent hover:underline">
                    Shelters i Danmark – tal og fakta
                  </Link>
                </li>
                <li>
                  <Link href="/ruteplanner" className="text-accent hover:underline">
                    Vandreruter med shelters
                  </Link>
                  {" "}– udforsk ruter fra Naturstyrelsen
                </li>
                <li>
                  <Link href="/turvenner" className="text-accent hover:underline">
                    Find turvenner til din tur
                  </Link>
                  {" "}– del oplevelsen med andre
                </li>
                <li>
                  <Link href="/tilbud" className="text-accent hover:underline">
                    Outdoor-tilbud
                  </Link>
                  {" "}– spar på grej til turen
                </li>
              </ul>
            </section>

            {/* Mobile: show booking above reviews (aside moves below on mobile) */}
            <BookingCard className="mb-10 lg:hidden" />

            {showAvailabilityPanel && (
              <div id={mobileAvailabilityTargetId} />
            )}

            {showReviews && reviews.length > 0 && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Anmeldelser
                </h2>
                <ul className="space-y-6">
                  {reviews.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-primary/10 bg-white/50 p-5 notranslate"
                      translate="no"
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
                        {(r.time || r.relative_time_description) && (
                          <span className="text-primary/60 text-sm">
                            · {r.time ? formatRelativeTimeDa(new Date(r.time)) : r.relative_time_description}
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

            <ShelterExperiencesSection
              shelterId={shelter.id}
              shelterSlug={slug}
              shelterTitle={shelter.title}
            />

            {coords && mapUrl && googleMapsUrl && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-bold text-primary mb-4">
                  Beliggenhed
                </h2>
                <ShelterLocationMap
                  lat={coords.lat}
                  lon={coords.lon}
                  openStreetMapUrl={mapUrl}
                  googleMapsUrl={googleMapsUrl}
                />
              </section>
            )}

            <ShelterFaq items={shelterFaqItems} jsonLd={shelterFaqJsonLd} />
          </article>

          <aside
            aria-label="Supplerende information om shelteret"
            className="lg:sticky lg:top-6 mt-8 lg:mt-0 space-y-4"
          >
            {/* Desktop: booking stays in sidebar */}
            <BookingCard className="hidden lg:block" />

            {showAvailabilityPanel && (
              <div id={desktopAvailabilityTargetId} />
            )}

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

            {coords && (
              <WeatherWidget latitude={coords.lat} longitude={coords.lon} initialForecast={weatherForecast} />
            )}

            <div className="rounded-2xl border border-primary/10 bg-white shadow-sm p-6">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Fakta
              </h2>
              <ShelterFacts
                shelter={shelter}
                coords={coords}
                firewood={firewood}
                hasShelterDkBooking={bookingUnits.length > 0}
              />
            </div>

            <NewsletterSignup variant="compact" source="shelter" />
          </aside>
        </div>
      </div>

      {/* Sticky mobile booking bar */}
      {showAvailabilityPanel && (
        <ResponsiveShelterAvailabilityPanel
          slug={slug}
          title={shelter.title}
          mobileTargetId={mobileAvailabilityTargetId}
          desktopTargetId={desktopAvailabilityTargetId}
          mobileClassName="mb-10"
          desktopClassName=""
        />
      )}

      {/* Mobile sticky CTA — covers external bookingUrl, single ShelterDK unit, and multi-unit */}
      {bookingUnits.length === 1 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-primary/10 p-3 lg:hidden" role="complementary" aria-label="Booking">
          <TrackedBookLink
            href={bookingUnits[0].href}
            shelterId={shelter.id}
            shelterSlug={slug}
            bookingType="shelterdk"
            position="sticky_mobile"
            ariaLabel={`Book ${shelter.title}`}
            className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Book dette shelter
          </TrackedBookLink>
        </div>
      ) : hasMultipleBookingUnits ? (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-primary/10 p-3 lg:hidden" role="complementary" aria-label="Booking">
          <a
            href="#booking-enheder"
            className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors"
          >
            Vælg shelter ({bookingUnits.length} på pladsen)
          </a>
        </div>
      ) : bookingUrl ? (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-primary/10 p-3 lg:hidden" role="complementary" aria-label="Booking">
          <TrackedExternalLink
            href={bookingUrl}
            eventLabel="Book dette shelter"
            bookContext={{
              shelterId: shelter.id,
              shelterSlug: slug,
              bookingType: "external",
              position: "sticky_mobile",
            }}
            aria-label={`Book ${shelter.title} – åbner i nyt vindue`}
            className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors"
          >
            <ExternalLink size={18} aria-hidden="true" />
            Book dette shelter
          </TrackedExternalLink>
        </div>
      ) : null}
    </main>
  );
}
