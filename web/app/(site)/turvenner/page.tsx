import type { Metadata } from "next";
import { Suspense } from "react";
import { TurvennerClient } from "@/components/TurvennerClient";

export const metadata: Metadata = {
  title: "Find turvenner — ShelterDK",
  description:
    "Find makkere til din næste sheltertur. Opret et opslag eller kontakt andre shelter-entusiaster i Danmark.",
  alternates: { canonical: "https://shelterdk.dk/turvenner" },
  openGraph: {
    title: "Find turvenner — ShelterDK",
    description:
      "Find makkere til din næste sheltertur. Opret et opslag eller kontakt andre shelter-entusiaster i Danmark.",
    url: "/turvenner",
  },
};

export default function TurvennerPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-2">
            Find turvenner
          </h1>
          <p className="text-primary/50 text-sm sm:text-base">
            Leder du efter nogen at dele en sheltertur med? Opret et opslag eller
            tag med på andres ture.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="text-center py-12 text-primary/30 text-sm">
              Indlæser...
            </div>
          }
        >
          <TurvennerClient />
        </Suspense>
      </div>
    </div>
  );
}
