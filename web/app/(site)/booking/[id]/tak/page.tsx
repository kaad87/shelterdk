import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import PrintButton from "@/components/PrintButton";
import {
  getLatestPaidPayment,
  getLatestPendingPayment,
  listPaymentsByBookingId,
} from "@/lib/payment-db";
import { reconcileCompletedCheckoutSession } from "@/lib/payment-reconcile";

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

  const loadBooking = async () =>
    createAdminClient()
      .from("shelter_bookings")
      .select("id, status, guest_token, guest_name, guest_count, check_in, check_out, created_at, bookable_shelters!inner(title)")
      .eq("id", id)
      .maybeSingle();

  let { data: booking } = await loadBooking();
  if (!booking) notFound();
  if (!t || booking.guest_token !== t) notFound();

  if (session_id) {
    try {
      await reconcileCompletedCheckoutSession(session_id, "page/booking/[id]/tak");
      ({ data: booking } = await loadBooking());
    } catch (err) {
      console.error("tak page: could not reconcile session:", err);
    }
  }

  if (!booking) notFound();

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
  const bookingReference = `BK-${id.slice(0, 8).toUpperCase()}`;
  const shelterTitle = (booking as any).bookable_shelters?.title ?? "Dit shelter";
  const bookingHref = `/min-booking/${encodeURIComponent(t)}`;

  if (isConfirmed) {
    return (
      <div className="print-receipt-shell min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="max-w-2xl w-full p-5 sm:p-8">
          <div className="text-center mb-6">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-700 mb-3">Betaling modtaget!</h1>
          <p className="text-primary/60 mb-3">
            Din booking er bekræftet. Du modtager en bekræftelse på e-mail inden for få minutter, og din bookingside fungerer som bookingbevis.
          </p>
          <p className="text-sm text-primary/40 mb-6">
            Skal ejeren aflyse, refunderes du automatisk inden for 5–10 hverdage.
          </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700 mb-1">
                  Bookingbevis
                </p>
                <h2 className="text-xl font-bold text-primary">{shelterTitle}</h2>
              </div>
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                Bekræftet
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ProofItem label="Bookingreference" value={bookingReference} />
              <ProofItem label="Gæst" value={booking.guest_name} />
              <ProofItem label="Ankomst" value={new Date(`${booking.check_in}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })} />
              <ProofItem label="Afrejse" value={new Date(`${booking.check_out}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })} />
              <ProofItem label="Antal personer" value={String(booking.guest_count)} />
              <ProofItem label="Betalt" value={`${paidPayment.amount_total_dkk} kr`} />
            </div>

            <div className="mt-4 text-xs text-primary/45 flex flex-wrap gap-x-5 gap-y-2">
              <span>Booking-ID: {booking.id}</span>
              <span>Oprettet: {new Date(booking.created_at).toLocaleString("da-DK")}</span>
              {paidPayment.paid_at ? <span>Betalt: {new Date(paidPayment.paid_at).toLocaleString("da-DK")}</span> : null}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <PrintButton label="Print denne kvittering" />
              <Link
                href={bookingHref}
                className="inline-flex items-center justify-center bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition"
              >
                Åbn mit bookingbevis
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center border border-primary/15 text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary/5 transition-colors"
              >
                Tilbage til forsiden
              </Link>
            </div>
          </div>
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @page {
                size: A4;
                margin: 14mm;
              }

              @media print {
                body {
                  background: white !important;
                }

                body * {
                  visibility: hidden;
                }

                .print-receipt-shell,
                .print-receipt-shell * {
                  visibility: visible;
                }

                .print-receipt-shell {
                  position: absolute;
                  inset: 0;
                  width: 100%;
                }
              }
            `,
          }}
        />
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
            ? "Stripe har sendt dig tilbage, men vi venter stadig på den endelige betalingsbekræftelse. Opdatér siden om et øjeblik, eller gå til din booking."
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

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-green-200/70 bg-green-50/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/40 mb-1">{label}</p>
      <p className="text-sm font-medium text-primary leading-relaxed">{value}</p>
    </div>
  );
}
