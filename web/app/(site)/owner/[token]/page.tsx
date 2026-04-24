import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookableShelterByOwnerToken, getBookingsForShelter } from "@/lib/booking-db";
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

  const bookings = await getBookingsForShelter(shelter.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <OwnerDashboard
          shelter={shelter}
          initialBookings={bookings}
          ownerToken={token}
        />
      </div>
    </div>
  );
}
