import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { getPaymentByBookingId } from "@/lib/payment-db";
import { createCheckoutSession, calculateFee } from "@/lib/stripe";
import { createBookingPayment } from "@/lib/payment-db";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function BetalPage({ params }: Props) {
  const { id } = await params;

  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("*, bookable_shelters!inner(*)")
    .eq("id", id)
    .single();

  if (!booking || booking.status === "cancelled" || booking.status === "rejected") {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shelter = (booking as any).bookable_shelters;
  const payment = await getPaymentByBookingId(id);

  if (payment?.status === "paid") {
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

  const priceDkk = shelter.shelter_price_dkk ?? 0;
  const feePct = shelter.platform_fee_pct ?? 5;
  const feeMin = shelter.platform_fee_min_dkk ?? 25;
  const { shelterDkk, platformDkk, totalDkk } = calculateFee(priceDkk, feePct, feeMin);

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
      } else if (payment && payment.status === "pending" && new Date(payment.expires_at) <= new Date()) {
        // Payment is pending but our expires_at has passed — show fallback
        checkoutUrl = null;
      } else {
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
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm">
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
            <span className="text-primary/60">Administrationsgebyr</span>
            <span>{platformDkk} kr</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2 mt-2">
            <span>I alt</span>
            <span>{totalDkk} kr</span>
          </div>
        </div>

        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="block w-full text-center bg-[#c5a059] text-white font-semibold py-3 rounded-xl hover:bg-[#b38f48] transition-colors"
          >
            Betal nu via MobilePay
          </a>
        ) : (
          <p className="text-center text-primary/50 text-sm">
            {booking.status === "pending"
              ? "Booking afventer bekræftelse fra ejeren."
              : "Kontakt os for hjælp til din booking."}
          </p>
        )}
      </div>
    </div>
  );
}
