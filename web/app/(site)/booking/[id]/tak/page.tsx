import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  getLatestPaidPayment,
  getLatestPendingPayment,
  listPaymentsByBookingId,
} from "@/lib/payment-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookingstatus | ShelterDK",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; t?: string }>;
}

export default async function TakPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { session_id, t } = await searchParams;

  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("id, status, guest_token")
    .eq("id", id)
    .maybeSingle();

  if (!booking) notFound();
  if (!t || booking.guest_token !== t) notFound();

  const payments = await listPaymentsByBookingId(id);
  const paidPayment = getLatestPaidPayment(payments);
  const pendingPayment = getLatestPendingPayment(payments);
  const sessionMatches = !session_id || paidPayment?.stripe_checkout_session_id === session_id;
  const isConfirmed = booking.status === "confirmed" && !!paidPayment && sessionMatches;
  const paymentHref = `/booking/${id}/betal?t=${encodeURIComponent(t)}`;
  const refreshParams = new URLSearchParams();
  if (session_id) refreshParams.set("session_id", session_id);
  if (t) refreshParams.set("t", t);
  const refreshHref = `/booking/${id}/tak${refreshParams.size > 0 ? `?${refreshParams.toString()}` : ""}`;

  if (isConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center max-w-md p-5 sm:p-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-700 mb-3">Betaling modtaget!</h1>
          <p className="text-primary/60 mb-3">
            Din booking er bekræftet. Du modtager en bekræftelse på e-mail inden for få minutter.
          </p>
          <p className="text-sm text-primary/40 mb-6">
            Skal ejeren aflyse, refunderes du automatisk inden for 5–10 hverdage.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition"
          >
            Tilbage til forsiden
          </Link>
        </div>
      </div>
    );
  }

  const isStillProcessing = !!pendingPayment || booking.status === "pending";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-5">
      <div className="text-center max-w-md p-5 sm:p-8 bg-white rounded-2xl shadow-sm border border-primary/8">
        <div className="text-5xl mb-4">{isStillProcessing ? "⏳" : "ℹ️"}</div>
        <h1 className="text-2xl font-bold text-primary mb-3">
          {isStillProcessing ? "Vi registrerer din betaling" : "Vi kunne ikke bekræfte betalingen"}
        </h1>
        <p className="text-primary/60 mb-5 leading-relaxed">
          {isStillProcessing
            ? "Stripe har sendt dig tilbage, men vi venter stadig på den endelige betalingsbekræftelse. Opdatér siden om et øjeblik, eller gå til betalingssiden igen."
            : "Vi kunne ikke se en gennemført betaling på denne booking. Hvis du stadig vil gennemføre bookingen, kan du gå tilbage til betalingssiden."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isStillProcessing && (
            <Link
              href={paymentHref}
              className="inline-block bg-[#c5a059] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#b38f48] transition-colors"
            >
              Gå til betalingssiden
            </Link>
          )}
          <Link
            href={refreshHref}
            className="inline-block border border-primary/15 text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary/5 transition-colors"
          >
            Opdatér siden
          </Link>
          {isStillProcessing && (
            <Link
              href={`/min-booking/${encodeURIComponent(t)}`}
              className="inline-block border border-primary/15 text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary/5 transition-colors"
            >
              Gå til min booking
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
