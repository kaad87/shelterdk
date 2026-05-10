import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  createBookingPayment,
  expireSiblingPendingPayments,
  getLatestPaidPayment,
  getLatestPendingPayment,
  listPendingPaymentsByBookingId,
  listPaymentsByBookingId,
  markPaymentExpired,
} from "@/lib/payment-db";
import {
  createCheckoutSession,
  calculateVatIncludedBreakdown,
  calculateBookingAmounts,
  expireCheckoutSession,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function BetalPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;

  const { data: booking } = await createAdminClient()
    .from("shelter_bookings")
    .select("*, bookable_shelters!inner(*)")
    .eq("id", id)
    .single();

  if (!booking || booking.status === "cancelled" || booking.status === "rejected") {
    notFound();
  }

  if (!t || booking.guest_token !== t) {
    notFound();
  }

  const shelter = (booking as any).bookable_shelters;
  const payments = await listPaymentsByBookingId(id);
  const paidPayment = getLatestPaidPayment(payments);
  const pendingPayment = getLatestPendingPayment(payments);
  const latestQuotedPayment = payments[0] ?? null;

  if (paidPayment && booking.status === "confirmed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">Betaling gennemført</h1>
          <p className="text-primary/60">
            Din betaling er registreret. Du modtager en bekræftelse på e-mail.
          </p>
        </div>
      </div>
    );
  }

  const fallbackAmounts = calculateBookingAmounts({
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    shelterPriceDkk: shelter.shelter_price_dkk,
    feePct: shelter.platform_fee_pct ?? 5,
    feeMinDkk: shelter.platform_fee_min_dkk ?? 25,
  });
  const shelterDkk = latestQuotedPayment?.amount_shelter_dkk ?? fallbackAmounts.shelterDkk;
  const platformDkk = latestQuotedPayment?.amount_platform_dkk ?? fallbackAmounts.platformDkk;
  const totalDkk = latestQuotedPayment?.amount_total_dkk ?? fallbackAmounts.totalDkk;
  const platformVatDkk =
    latestQuotedPayment?.amount_platform_dkk != null
      ? calculateVatIncludedBreakdown(latestQuotedPayment.amount_platform_dkk).vatDkk
      : fallbackAmounts.platformVatDkk;

  let checkoutUrl: string | null = null;
  let isAwaitingWebhook = !!paidPayment && booking.status === "pending";
  const canResumePayment =
    booking.source !== "owner_manual" &&
    !paidPayment &&
    ((shelter.payment_mode === "upfront" && ["pending", "confirmed"].includes(booking.status)) ||
      (shelter.payment_mode !== "upfront" && booking.status === "confirmed"));

  if (canResumePayment) {
    try {
      const hasActivePendingPayment =
        pendingPayment &&
        new Date(pendingPayment.expires_at) > new Date();

      if (hasActivePendingPayment) {
        // Reuse existing Stripe session — avoid creating orphaned sessions on every load
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(
          pendingPayment.stripe_checkout_session_id
        );
        if (session.status === "open" && session.url) {
          checkoutUrl = session.url;
        } else if (session.status === "complete") {
          isAwaitingWebhook = true;
        } else {
          await markPaymentExpired(pendingPayment.id).catch((err) => {
            console.error("betal page: could not mark stale payment as expired:", err);
          });
        }
      } else {
        if (pendingPayment && new Date(pendingPayment.expires_at) <= new Date()) {
          await markPaymentExpired(pendingPayment.id).catch((err) => {
            console.error("betal page: could not mark expired payment:", err);
          });
        }
      }

      if (!checkoutUrl) {
        // No active session — create a new one and retire any stale siblings.
        if (isAwaitingWebhook) {
          // The guest has already completed checkout; wait for webhook rather than opening a new charge.
        } else {
          const { url, sessionId } = await createCheckoutSession(booking, shelter, {
            shelterDkk,
            platformDkk,
          });
          const stalePayments = await listPendingPaymentsByBookingId(id);
          const created = await createBookingPayment({
            bookingId: id,
            stripeCheckoutSessionId: sessionId,
            amountTotalDkk: totalDkk,
            amountShelterDkk: shelterDkk,
            amountPlatformDkk: platformDkk,
          });
          await expireSiblingPendingPayments(id, created.id).catch((err) => {
            console.error("betal page: could not expire sibling pending payments:", err);
          });
          await Promise.all(
            stalePayments.map((payment) =>
              expireCheckoutSession(payment.stripe_checkout_session_id).catch((err) => {
                console.error("betal page: could not expire sibling Stripe session:", err);
              })
            )
          );
          checkoutUrl = url;
        }
      }
    } catch (err) {
      console.error("betal page: checkout error:", err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="max-w-md w-full p-5 sm:p-8 bg-white rounded-2xl shadow-sm">
        <h1 className="text-2xl font-bold text-primary mb-1">{shelter.title}</h1>
        <p className="text-primary/50 text-sm mb-6">
          {new Date(booking.check_in).toLocaleDateString("da-DK", { day: "numeric", month: "long" })}
          {" – "}
          {new Date(booking.check_out).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-2 mb-6">
          {shelterDkk > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-primary/60">Overnatning</span>
              <span>{shelterDkk} kr</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-primary/60">Administrationsgebyr inkl. moms</span>
            <span>{platformDkk} kr</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2 mt-2">
            <span>I alt</span>
            <span>{totalDkk} kr</span>
          </div>
          <p className="text-xs text-primary/40 pt-1">
            Heraf {platformVatDkk.toFixed(2).replace(".", ",")} kr moms.
          </p>
        </div>

        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="block w-full text-center bg-[#c5a059] text-white font-semibold py-3 rounded-xl hover:bg-[#b38f48] transition-colors"
          >
            Gå til betaling
          </a>
        ) : (
          <p className="text-center text-primary/50 text-sm">
            {isAwaitingWebhook
              ? "Din betaling er gennemført, og vi venter på den endelige bekræftelse fra betalingssystemet. Vent et øjeblik og prøv igen."
              : booking.status === "pending" && paidPayment
              ? "Din betaling er modtaget og afventer den endelige bekræftelse."
              : shelter.payment_mode === "upfront" && booking.status === "pending"
              ? "Vi kunne ikke genåbne betalingen lige nu. Prøv igen om et øjeblik."
              : booking.status === "pending"
              ? "Booking afventer bekræftelse fra ejeren."
              : "Vi kunne ikke oprette et betalingslink lige nu. Prøv at genindlæse siden om et øjeblik."}
          </p>
        )}
      </div>
    </div>
  );
}
