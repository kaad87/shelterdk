import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getPaymentByBookingId, markPaymentExpired } from "@/lib/payment-db";
import { createCheckoutSession, calculateBookingAmounts } from "@/lib/stripe";
import { createBookingPayment } from "@/lib/payment-db";

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
  const payment = await getPaymentByBookingId(id);

  if (payment?.status === "paid" && booking.status === "confirmed") {
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

  const { shelterDkk, platformDkk, platformVatDkk, totalDkk } = calculateBookingAmounts({
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    shelterPriceDkk: shelter.shelter_price_dkk,
    feePct: shelter.platform_fee_pct ?? 5,
    feeMinDkk: shelter.platform_fee_min_dkk ?? 25,
  });

  let checkoutUrl: string | null = null;
  if (booking.status === "confirmed") {
    try {
      const hasActivePendingPayment =
        payment &&
        payment.status === "pending" &&
        new Date(payment.expires_at) > new Date();

      if (hasActivePendingPayment) {
        // Reuse existing Stripe session — avoid creating orphaned sessions on every load
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(
          payment.stripe_checkout_session_id
        );
        checkoutUrl = session.url ?? null;
      } else {
        if (payment && payment.status === "pending" && new Date(payment.expires_at) <= new Date()) {
          await markPaymentExpired(payment.id).catch((err) => {
            console.error("betal page: could not mark expired payment:", err);
          });
        }
        // No active session — create a new one
        const { url, sessionId } = await createCheckoutSession(booking, shelter);
        await createBookingPayment({
          bookingId: id,
          stripeCheckoutSessionId: sessionId,
          amountTotalDkk: totalDkk,
          amountShelterDkk: shelterDkk,
          amountPlatformDkk: platformDkk,
        });
        checkoutUrl = url;
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
            {booking.status === "pending" && payment?.status === "paid"
              ? "Din betaling er modtaget og afventer den endelige bekræftelse."
              : booking.status === "pending"
              ? "Booking afventer bekræftelse fra ejeren."
              : "Vi kunne ikke oprette et betalingslink lige nu. Prøv at genindlæse siden om et øjeblik."}
          </p>
        )}
      </div>
    </div>
  );
}
