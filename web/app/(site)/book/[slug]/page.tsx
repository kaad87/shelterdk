import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getBookableShelterBySlug } from "@/lib/booking-db";
import { BookingForm } from "@/components/booking/BookingForm";
import { getPhotoUrls } from "@shared/lib/shelter-detail";
import type { Shelter } from "@shared/types/shelter";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter) return {};
  return {
    title: `Book ${shelter.title}`,
    description: shelter.description ?? `Send en bookingforespørgsel til ${shelter.title}. Gratis og uforpligtende.`,
    robots: { index: false, follow: false },
  };
}

export default async function BookShelterPage({ params }: Props) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter || shelter.booking_mode === "iframe") notFound();
  const isUpfront = shelter.payment_mode === "upfront";

  const linkedShelter = shelter.shelter_id
    ? await createAdminClient()
        .from("shelters")
        .select(
          "id, title, slug, location, place, kommune, region, image_url, image_urls, user_image_urls, geofa_raw, blur_data_url"
        )
        .eq("id", shelter.shelter_id)
        .maybeSingle()
        .then((r) => (r.data as Shelter | null) ?? null)
    : null;

  const previewImage = linkedShelter ? getPhotoUrls(linkedShelter)[0] ?? null : null;
  const humanLocation =
    linkedShelter?.location && !/^POINT\s*\(/i.test(linkedShelter.location)
      ? linkedShelter.location
      : null;
  const placeLabel =
    linkedShelter?.place ||
    humanLocation ||
    linkedShelter?.kommune ||
    linkedShelter?.region ||
    null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <div className="mb-8 rounded-3xl border border-primary/8 bg-white shadow-sm overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[320px_1fr]">
            <div className="relative min-h-[220px] bg-primary/5">
              {previewImage ? (
                <Image
                  src={previewImage}
                  alt={linkedShelter?.title ?? shelter.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 320px"
                  {...(linkedShelter?.blur_data_url
                    ? {
                        placeholder: "blur" as const,
                        blurDataURL: linkedShelter.blur_data_url,
                      }
                    : {})}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
              )}
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-2">
                Book shelter
              </p>
              <h1 className="font-serif text-3xl font-bold text-primary leading-tight">
                {shelter.title}
              </h1>
              {placeLabel && (
                <p className="mt-2 text-sm text-primary/55">
                  {placeLabel}
                </p>
              )}
              <p className="mt-4 text-sm sm:text-base text-primary/70 leading-relaxed max-w-2xl">
                {isUpfront
                  ? "Her kan du booke dette shelter direkte. Vælg dine datoer, gennemfør betalingen sikkert, og modtag bookingbevis på mail og på ShelterDK."
                  : "Her kan du sende en bookingforespørgsel til dette shelter. Vælg dine datoer, send forespørgslen, og modtag svar og bookingbevis på mail og på ShelterDK, når bookingen er bekræftet."}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/40 mb-1">1. Vælg datoer</p>
                  <p className="text-sm text-primary/70">Se kalenderen og vælg ankomst og afrejse.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/40 mb-1">2. Gennemfør booking</p>
                  <p className="text-sm text-primary/70">
                    {isUpfront
                      ? "Udfyld dine oplysninger og betal sikkert med kort eller MobilePay."
                      : "Udfyld dine oplysninger og send din forespørgsel til shelter-ejeren."}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/40 mb-1">3. Modtag bookingbevis</p>
                  <p className="text-sm text-primary/70">
                    {isUpfront
                      ? "Du modtager bookingbevis på mail og på ShelterDK med det samme efter betaling."
                      : "Du modtager bookingbevis på mail og på ShelterDK, når bookingen er bekræftet."}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(isUpfront
                  ? ["Sikker betaling", "Kort og MobilePay", "Bookingbevis på mail og ShelterDK"]
                  : ["Gratis at sende forespørgsel", "Intet kort kræves nu", "Bookingbevis efter bekræftelse"]
                ).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-medium text-primary/65"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1.5 text-accent font-medium">
                  Maks {shelter.max_persons} personer
                </span>
                {linkedShelter?.slug ? (
                  <Link
                    href={`/shelter/${linkedShelter.slug}`}
                    className="inline-flex items-center rounded-full border border-primary/10 px-3 py-1.5 text-primary/70 hover:border-accent/30 hover:text-accent transition-colors"
                  >
                    Se infosiden for shelteret
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <BookingForm
          shelterSlug={shelter.slug}
          shelterTitle={shelter.title}
          maxPersons={shelter.max_persons}
          description={shelter.description}
          showPageHeader={false}
          hideTrustDetails
          successPath={`/book/${shelter.slug}/tak`}
          paymentMode={shelter.payment_mode}
          shelterPriceDkk={shelter.shelter_price_dkk ?? 0}
          platformFeePct={shelter.platform_fee_pct}
          platformFeeMinDkk={shelter.platform_fee_min_dkk}
        />
      </div>
    </div>
  );
}
