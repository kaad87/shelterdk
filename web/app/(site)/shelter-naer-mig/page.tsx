import type { Metadata } from "next";
import { ShelterNaerMigClient } from "@/components/ShelterNaerMigClient";

const PAGE_TITLE = "Find shelter nær mig | ShelterDK";
const PAGE_DESCRIPTION =
  "Find shelters og overnatningspladser i naturen tæt på din nuværende placering. Klik og se de nærmeste shelters på kort afstand – hurtigt og nemt.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/shelter-naer-mig" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/shelter-naer-mig",
  },
};

export default function ShelterNaerMigPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
            Find shelter nær mig
          </h1>
        </header>
        <ShelterNaerMigClient />
      </div>
    </div>
  );
}
