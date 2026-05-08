import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, getShelterGroupByDbShelterId } from "@/lib/owner-db";
import { getBookingsForShelter, getBlockedDatesWithSource } from "@/lib/booking-db";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EjerShelterBookingerPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) notFound();

  const [bookings, blockedDates, groupShelters] = await Promise.all([
    getBookingsForShelter(shelter.id),
    getBlockedDatesWithSource(shelter.id),
    shelter.shelter_id
      ? getShelterGroupByDbShelterId(shelter.shelter_id, user.id)
      : Promise.resolve([]),
  ]);

  const sharedSettingsPath =
    shelter.shelter_id && groupShelters.length > 1
      ? `/ejer/plads/${shelter.shelter_id}/rediger`
      : null;

  return (
    <div>
      <div className="mb-6">
        <a href="/ejer/dashboard" className="text-sm text-primary/40 hover:text-primary transition-colors">
          ← Tilbage til dashboard
        </a>
      </div>

      <OwnerDashboard
        shelter={shelter}
        initialBookings={bookings}
        initialBlockedDates={blockedDates}
        apiBasePath={`/api/ejer/shelter/${shelter.id}/bookinger`}
        sharedSettingsPath={sharedSettingsPath}
      />
    </div>
  );
}
