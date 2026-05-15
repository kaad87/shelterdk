import type { Metadata } from "next";
import type { BookableShelter, ShelterBooking } from "@/types/booking";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

export const metadata: Metadata = {
  title: "Demo: Ejer-dashboard | ShelterDK",
  robots: "noindex",
};

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const DEMO_SHELTER: BookableShelter = {
  id: "demo",
  slug: "demo",
  title: "Skovhytten ved Søen",
  description: "Hyggelig shelterplads ved skovbrynet med udsigt over søen. Plads til 6 personer, bålplads og brænde på stedet.",
  shelter_id: null,
  owner_email: "demo@shelterdk.dk",
  owner_token: "demo-token",
  auth_user_id: null,
  max_persons: 6,
  booking_mode: "shelterdk",
  ical_import_url: null,
  ical_last_synced_at: null,
  shelter_price_dkk: 0,
  platform_fee_pct: 5,
  platform_fee_min_dkk: 25,
  payment_mode: "after_confirmation",
  cancellation_cutoff_hours: 48,
  created_at: "2025-01-01T00:00:00Z",
};

function makeBooking(
  id: string,
  name: string,
  email: string,
  persons: number,
  checkInOffset: number,
  nights: number,
  status: ShelterBooking["status"],
  message?: string
): ShelterBooking {
  return {
    id,
    bookable_shelter_id: "demo",
    guest_name: name,
    guest_email: email,
    guest_count: persons,
    check_in: isoDate(checkInOffset),
    check_out: isoDate(checkInOffset + nights),
    message: message ?? null,
    status,
    created_at: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    guest_token: `guest-token-${id}`,
    cancelled_at: null,
    cancelled_by: null,
    source: "guest",
    quoted_shelter_dkk: null,
    quoted_platform_dkk: null,
    quoted_total_dkk: null,
  };
}

const DEMO_BOOKINGS: ShelterBooking[] = [
  makeBooking("demo-1", "Lene Jørgensen", "lene@example.dk", 2, 3, 2, "pending",
    "Vi glæder os rigtig meget! Kommer vi fra Aalborg og er to voksne."),
  makeBooking("demo-2", "Mads Hansen", "mads@example.dk", 4, 10, 3, "confirmed"),
  makeBooking("demo-3", "Sara og Mikkel Møller", "sara@example.dk", 2, 22, 1, "pending"),
  makeBooking("demo-4", "Jens Christiansen", "jens@example.dk", 3, -8, 2, "confirmed"),
];

const DEMO_BLOCKED: { date: string; source: "manual" | "ical_sync" }[] = [
  { date: isoDate(17), source: "manual" },
  { date: isoDate(18), source: "manual" },
];

export default function DemoEjerPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="border-b border-primary/10 bg-white px-5 py-4 flex items-center justify-between">
        <a href="/" className="font-serif font-bold text-lg text-primary tracking-tight">
          ShelterDK
        </a>
        <span className="text-xs text-primary/40 uppercase tracking-widest font-semibold">Ejer-portal</span>
      </header>

      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-center">
        <p className="text-xs text-amber-800">
          <strong>Demo</strong> — dette er et eksempel på ejer-dashboardet. Ingen rigtige data vises.{" "}
          <a href="/aktiver-booking" className="underline font-semibold hover:no-underline">
            Aktiver booking til dit shelter →
          </a>
        </p>
      </div>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Ejer-portal</p>
          <h1 className="font-serif text-2xl font-bold text-primary">Mine shelters</h1>
        </div>

        <OwnerDashboard
          shelter={DEMO_SHELTER}
          initialBookings={DEMO_BOOKINGS}
          initialBlockedDates={DEMO_BLOCKED}
          apiBasePath="/api/demo/ejer"
          calendarExportUrl=""
          sharedSettingsPath={null}
        />
      </main>
    </div>
  );
}
