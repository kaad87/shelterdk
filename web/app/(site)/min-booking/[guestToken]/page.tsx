import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByGuestToken, getBookableShelterByPk, isRefundEligible } from "@/lib/booking-db";
import { BookingPageClient } from "./BookingPageClient";

interface Props { params: Promise<{ guestToken: string }> }

export const metadata: Metadata = {
  title: { absolute: "Min booking | ShelterDK" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GuestBookingPage({ params }: Props) {
  const { guestToken } = await params;

  const booking = await getBookingByGuestToken(guestToken);
  if (!booking) notFound();

  const shelter = await getBookableShelterByPk(booking.bookable_shelter_id);
  if (!shelter) notFound();

  const refundEligible = booking.status === "confirmed"
    ? isRefundEligible(booking.check_in, shelter.cancellation_cutoff_hours)
    : false;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <BookingPageClient
          booking={booking}
          shelterTitle={shelter.title}
          refundEligible={refundEligible}
          cancellationCutoffHours={shelter.cancellation_cutoff_hours}
          guestToken={guestToken}
        />
      </div>
    </div>
  );
}
