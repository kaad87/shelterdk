import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";
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
  resolveBookingAmounts,
  expireCheckoutSession,
} from "@/lib/stripe";
import { reconcileCompletedCheckoutSession } from "@/lib/payment-reconcile";
import {
  createPaymentAccessToken,
  verifyPaymentAccessToken,
} from "@/lib/booking-access";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string; t?: string; session_id?: string; cancelled?: string }>;
}

export default async function BetalPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { access, t, session_id, cancelled } = await searchParams;
  const wasCancelled = cancelled === "1";

  const loadBooking = async () =>
    createAdminClient()
      .from("shelter_bookings")
      .select("*, bookable_shelters!inner(*, shelters(image_url, slug))")
      .eq("id", id)
      .single();

  let { data: booking } = await loadBooking();
  if (!booking || booking.status === "cancelled" || booking.status === "rejected") {
    notFound();
  }

  let paymentAccessToken = access ?? null;

  if (!paymentAccessToken && t && booking.guest_token === t) {
    const legacyRedirectParams = new URLSearchParams();
    legacyRedirectParams.set("access", createPaymentAccessToken(booking));
    if (session_id) legacyRedirectParams.set("session_id", session_id);
    redirect(`/booking/${id}/betal?${legacyRedirectParams.toString()}`);
  }

  if (!paymentAccessToken || !verifyPaymentAccessToken(paymentAccessToken, booking)) {
    notFound();
  }

  if (session_id) {
    try {
      await reconcileCompletedCheckoutSession(session_id, "page/booking/[id]/betal");
      ({ data: booking } = await loadBooking());
    } catch (err) {
      console.error("betal page: could not reconcile session from query:", err);
    }
  }

  let shelter = (booking as any).bookable_shelters;
  let payments = await listPaymentsByBookingId(id);
  const paidPayment = getLatestPaidPayment(payments);
  let pendingPayment = getLatestPendingPayment(payments);
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

  const fallbackAmounts = resolveBookingAmounts(booking, shelter);
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
      if (pendingPayment && new Date(pendingPayment.expires_at) > new Date()) {
        const currentPendingPayment = pendingPayment;
        // Reuse existing Stripe session — avoid creating orphaned sessions on every load
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(
          currentPendingPayment.stripe_checkout_session_id
        );
        if (session.status === "open" && session.url) {
          checkoutUrl = session.url;
        } else if (session.status === "complete") {
          await reconcileCompletedCheckoutSession(
            currentPendingPayment.stripe_checkout_session_id,
            "page/booking/[id]/betal"
          );
          ({ data: booking } = await loadBooking());
          shelter = (booking as any).bookable_shelters;
          payments = await listPaymentsByBookingId(id);
          pendingPayment = getLatestPendingPayment(payments);
          const reconciledPaidPayment = getLatestPaidPayment(payments);
          if (reconciledPaidPayment && booking.status === "confirmed") {
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
          isAwaitingWebhook = true;
        } else {
          await markPaymentExpired(currentPendingPayment.id).catch((err) => {
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

  const rawShelterImageUrl: string | null = shelter.shelters?.image_url ?? null;
  const shelterImageUrl = rawShelterImageUrl
    ? getProxiedImageSrc(rawShelterImageUrl, { q: 75, w: 960 })
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] py-8 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm overflow-hidden">
        {shelterImageUrl ? (
          <div className="relative w-full h-40 bg-primary/10">
            <Image
              src={shelterImageUrl}
              alt={shelter.title}
              fill
              sizes="448px"
              className="object-cover"
              unoptimized={isUnoptimizedImageUrl(shelterImageUrl)}
              priority
            />
          </div>
        ) : null}

        <div className="p-5 sm:p-8">
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

          {wasCancelled && checkoutUrl && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Du afbrød betalingen. Din booking er stadig reserveret — klik herunder for at fortsætte hvor du slap.
            </div>
          )}

          {checkoutUrl ? (
            <>
              {/* Trust line above the pay button */}
              <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-primary/55">
                <span className="flex items-center gap-1">🔒 Sikker betaling</span>
                <span aria-hidden>·</span>
                <span>MobilePay og kort</span>
                <span aria-hidden>·</span>
                <span>Fuld refundering ved aflysning</span>
              </div>

              <a
                href={checkoutUrl}
                className="block w-full text-center bg-[#c5a059] text-white font-semibold py-3 rounded-xl hover:bg-[#b38f48] transition-colors"
              >
                {wasCancelled ? "Fortsæt betaling" : "Gå til betaling"}
              </a>

              <p className="mt-2 text-center text-[11px] text-primary/35">
                Du betales sikkert via Stripe. Vi opbevarer ikke dine kortoplysninger.
              </p>

              {/* Next-step list */}
              <ol className="mt-5 space-y-2 text-xs text-primary/60 border-t border-primary/8 pt-4">
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/8 text-primary/70 font-semibold flex items-center justify-center">1</span>
                  <span>Du betaler sikkert via Stripe (MobilePay eller kort)</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/8 text-primary/70 font-semibold flex items-center justify-center">2</span>
                  <span>Du modtager en bekræftelses-mail med dine bookingoplysninger</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/8 text-primary/70 font-semibold flex items-center justify-center">3</span>
                  <span>Vis mailen eller bookingbeviset ved ankomst på shelterpladsen</span>
                </li>
              </ol>
            </>
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
    </div>
  );
}
