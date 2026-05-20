import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByGuestToken, getBookableShelterByPk, isRefundEligible } from "@/lib/booking-db";
import {
  getLatestPaidPayment,
  getLatestPendingPayment,
  listPaymentsByBookingId,
} from "@/lib/payment-db";
import { createPaymentAccessToken } from "@/lib/booking-access";
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
  const payments = await listPaymentsByBookingId(booking.id);
  const paidPayment = getLatestPaidPayment(payments);
  const pendingPayment = getLatestPendingPayment(payments);

  const refundEligible = booking.status === "confirmed"
    ? isRefundEligible(booking.check_in, shelter.cancellation_cutoff_hours)
    : false;
  const paymentHref =
    booking.source !== "owner_manual" &&
    !paidPayment &&
    (
      (shelter.payment_mode === "upfront" &&
        ["pending", "confirmed"].includes(booking.status)) ||
      (shelter.payment_mode === "after_confirmation" &&
        booking.status === "confirmed" &&
        !!pendingPayment)
    )
      ? `/booking/${booking.id}/betal?access=${encodeURIComponent(createPaymentAccessToken(booking))}`
      : null;
  const paymentLabel =
    shelter.payment_mode === "after_confirmation"
      ? "Betal booking"
      : pendingPayment
      ? "Fortsæt betaling"
      : "Betal booking";

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <BookingPageClient
          booking={booking}
          shelterTitle={shelter.title}
          refundEligible={refundEligible}
          cancellationCutoffHours={shelter.cancellation_cutoff_hours}
          guestToken={guestToken}
          paymentHref={paymentHref}
          paymentLabel={paymentHref ? paymentLabel : null}
          amountPaidDkk={paidPayment?.amount_total_dkk ?? null}
          paidAt={paidPayment?.paid_at ?? null}
        />
      </div>
    </div>
  );
}
