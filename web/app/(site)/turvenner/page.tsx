import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { TurvennerClient } from "@/components/TurvennerClient";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

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
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Turvenner" }]} />
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

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-lg font-bold text-primary mb-3">
            Nyttige ressourcer
          </h2>
          <ul className="space-y-2 text-sm text-primary/80">
            <li>
              <Link href="/soeg" className="text-accent hover:underline">
                Søg shelters
              </Link>
              {" "}– find det perfekte shelter til din tur
            </li>
            <li>
              <Link href="/ruteplanner" className="text-accent hover:underline">
                Vandreruter med GPX
              </Link>
              {" "}– udforsk ruter med shelters langs vejen
            </li>
            <li>
              <Link href="/omraade" className="text-accent hover:underline">
                Udforsk områder
              </Link>
              {" "}– find shelters efter område i Danmark
            </li>
          </ul>
        </section>
      </div>
    </div>
    </>
  );
}
