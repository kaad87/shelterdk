import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByGuestToken } from "@/lib/booking-db";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { GuestReviewForm } from "@/components/GuestReviewForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Anmeld dit ophold | ShelterDK" },
  robots: { index: false, follow: false },
};

export default async function AnmeldPage({
  params,
}: {
  params: Promise<{ guestToken: string }>;
}) {
  const { guestToken } = await params;
  const booking = await getBookingByGuestToken(guestToken);
  if (!booking || booking.status !== "confirmed") notFound();

  const admin = createAdminClient();
  const [{ data: unit }, { data: existing }] = await Promise.all([
    admin
      .from("bookable_shelters")
      .select("title")
      .eq("id", booking.bookable_shelter_id)
      .single(),
    admin
      .from("shelter_guest_reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);
  const shelterTitle = unit?.title ?? "dit shelter";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-2 font-serif text-2xl font-bold text-primary">Anmeld dit ophold</h1>
        <p className="mb-6 text-sm text-primary/60">
          Din oplevelse hjælper andre med at finde det rigtige shelter.
        </p>
        {existing ? (
          <div className="rounded-2xl border border-primary/10 bg-white p-6 text-center shadow-sm">
            <p className="font-serif text-lg font-bold text-primary mb-1">
              Du har allerede anmeldt dette ophold
            </p>
            <p className="text-sm text-primary/60">Tak for at dele din oplevelse!</p>
          </div>
        ) : (
          <GuestReviewForm guestToken={guestToken} shelterTitle={shelterTitle} />
        )}
      </div>
    </div>
  );
}
