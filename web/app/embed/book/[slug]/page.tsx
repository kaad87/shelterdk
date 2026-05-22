import { notFound } from "next/navigation";
import { getBookableShelterBySlug } from "@/lib/booking-db";
import { BookingForm } from "@/components/booking/BookingForm";

interface Props { params: Promise<{ slug: string }> }

export default async function EmbedBookPage({ params }: Props) {
  const { slug } = await params;
  const shelter = await getBookableShelterBySlug(slug);
  if (!shelter || shelter.booking_mode === "shelterdk") notFound();

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <BookingForm
          shelterSlug={shelter.slug}
          shelterTitle={shelter.title}
          maxPersons={shelter.max_persons}
          description={shelter.description}
          paymentMode={shelter.payment_mode}
          shelterPriceDkk={shelter.shelter_price_dkk ?? 0}
          platformFeePct={shelter.platform_fee_pct}
          platformFeeMinDkk={shelter.platform_fee_min_dkk}
          successPath={`/embed/book/${shelter.slug}/tak`}
        />
      </div>
    </div>
  );
}
