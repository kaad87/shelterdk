import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/BookingForm";

export const metadata: Metadata = {
  title: "Demo: Book shelter | ShelterDK",
  robots: "noindex",
};

export default function DemoBookPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] px-5 py-8 sm:px-8">

      {/* Demo banner */}
      <div className="mx-auto max-w-5xl mb-6">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">
            <strong>Demo</strong> — dette er en demoshelter med fiktive data. Ingen rigtig booking oprettes.
          </p>
          <a
            href="/aktiver-booking"
            className="shrink-0 text-xs font-semibold text-amber-700 underline hover:no-underline whitespace-nowrap"
          >
            Aktiver til dit shelter →
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <BookingForm
          shelterSlug="demo"
          shelterTitle="Skovhytten ved Søen"
          maxPersons={6}
          description="Hyggelig shelterplads ved skovbrynet med udsigt over søen. Plads til 6 personer, bålplads og brænde på stedet."
          paymentMode="after_confirmation"
          shelterPriceDkk={0}
          platformFeeMinDkk={25}
          successPath="/demo/book/tak"
        />
      </div>
    </div>
  );
}
