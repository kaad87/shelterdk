"use client";

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
import { CommunityContributionPanel } from "@/components/CommunityContributionPanel";
import { CommunityApprovedSection } from "@/components/CommunityApprovedSection";
import type { DailyForecast } from "@/lib/weather";
import type { Shelter } from "@/types/shelter";
import type { FaqItem } from "@/lib/faq";
import { formatRelativeTimeDa } from "@/lib/relative-time-da";

export interface BreadcrumbLink {
  label: string;
  href?: string;
}

interface ShelterDetailContentProps {
  shelter: Shelter;
  slug: string;
  breadcrumbs: BreadcrumbLink[];
  city: string | null;
  /** Område til intern linking: "Se alle shelters i [område]" */
  areaSlug?: string | null;
  areaName?: string | null;
  /** Bålplads – når data findes. */
  firewood?: boolean | null;
  /** Links til relaterede filterlister (fx shelter-med-toilet, shelter-med-vand). */
  facilityLinks?: { label: string; href: string }[];
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
    areaSlug = null,
    areaName = null,
    firewood = null,
    facilityLinks = [],
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
    bookingFallbackHint = null,
    isBookable,
    shelterFaqItems,
    shelterFaqJsonLd,
    reviews,
    coords,
    weatherForecast = null,
  } = props;

  const BookingCard = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-2xl border border-primary/10 bg-white shadow-sm p-6 ${className}`}>
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
      ) : isBookable ? (
        <p className="text-primary/80 text-center py-2">
          {bookingFallbackHint === "naturstyrelsen" ? (
            <>
              Søg eller book på{" "}
              <a
                href="https://book.naturstyrelsen.dk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:no-underline"
              >
                book.naturstyrelsen.dk
              </a>
              .
            </>
          ) : (
            <>
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
            </>
          )}
        </p>
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
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className="text-primary/50">/</span>}
              {b.href ? (
                <Link href={b.href} className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
                  {b.label}
                </Link>
              ) : (
                <span className="text-primary font-medium truncate max-w-[200px] sm:max-w-none">
                  {b.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        {areaSlug && areaName && (
          <p className="mb-4 text-sm text-primary/80">
            <Link
              href={`/omraade/${areaSlug}`}
              className="text-accent font-medium hover:underline"
            >
              Se alle shelters i {areaName} →
            </Link>
          </p>
        )}

        <div className="lg:grid lg:grid-cols-[1fr,340px] lg:gap-10 lg:items-start">
          <article className="min-w-0">
            <ShelterGallery
              urls={allPhotoUrls}
              title={shelter.title}
              rating={showReviews ? shelter.google_rating : null}
              ratingsTotal={showReviews ? shelter.google_user_ratings_total : null}
              region={city}
              slug={slug}
              shelterId={shelter.id}
            />

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

            <div className="mb-6">
              <ShareButtons title={shelter.title} url={`/shelter/${slug}`} />
            </div>

            <section className="mb-10">
              {features.length > 0 && (
                <>
                  <h2 className="font-serif text-xl font-bold text-primary mb-4">
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
                </>
              )}

            </section>

            <div className="mb-6">
              <CommunityContributionPanel slug={slug} />
              <CommunityApprovedSection slug={slug} shelter={shelter} />
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
                {breadcrumbs.length >= 2 && breadcrumbs[1]?.href && (
                  <li>
                    <Link href={breadcrumbs[1].href} className="text-accent hover:underline">
                      Shelters i {breadcrumbs[1].label}
                    </Link>
                    {" "}– alle shelters i regionen
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
              </ul>
            </section>

            {/* Mobile: show booking above reviews (aside moves below on mobile) */}
            <BookingCard className="mb-10 lg:hidden" />

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

          <aside className="lg:sticky lg:top-6 mt-8 lg:mt-0 space-y-4">
            {/* Desktop: booking stays in sidebar */}
            <BookingCard className="hidden lg:block" />

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
              <ShelterFacts shelter={shelter} coords={coords} firewood={firewood} />
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky mobile booking bar */}
      {bookingUrl && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-primary/10 p-3 lg:hidden" role="complementary" aria-label="Booking">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${shelter.title} – åbner i nyt vindue`}
            className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors"
          >
            <ExternalLink size={18} aria-hidden="true" />
            Book dette shelter
          </a>
        </div>
      )}
    </div>
  );
}
