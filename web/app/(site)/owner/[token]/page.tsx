import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookableShelterByOwnerToken, getBookingsForShelter, getBlockedDatesWithSource } from "@/lib/booking-db";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

interface Props { params: Promise<{ token: string }> }

export const metadata: Metadata = {
  title: { absolute: "Ejer-dashboard | ShelterDK" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: Props) {
  const { token } = await params;
  const shelter = await getBookableShelterByOwnerToken(token);
  if (!shelter) notFound();

  const [bookings, blockedDates] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesWithSource(shelter.id),
  ]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <OwnerDashboard
          shelter={shelter}
          initialBookings={bookings}
          initialBlockedDates={blockedDates}
          apiBasePath={`/api/owner/${token}`}
        />
      </div>
    </div>
  );
}
