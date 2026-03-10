import type { Metadata } from "next";
import Link from "next/link";
import { ShelterNaerMigClient } from "@/components/ShelterNaerMigClient";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

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

const breadcrumbItems = [
  { label: "Hjem", href: "/" },
  { label: "Søg shelters", href: "/soeg" },
  { label: "Shelter nær mig" },
];

export default function ShelterNaerMigPage() {
  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">
              Find shelter nær mig
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Tillad adgang til din placering, og se hvilke shelters der ligger
              tættest på dig lige nu. Resultatet vises på kort og liste –
              sorteret efter afstand.
            </p>
          </header>

          <ShelterNaerMigClient />

          <section className="mt-12 prose prose-primary max-w-none text-primary/90 space-y-4">
            <h2 className="font-serif text-xl font-bold text-primary">
              Hvordan finder jeg et shelter nær mig?
            </h2>
            <p>
              Klik på knappen ovenfor og godkend adgang til din placering i
              browseren. ShelterDK beregner derefter afstanden til alle
              registrerede shelters og viser de nærmeste øverst. Du kan klikke
              på et shelter for at se billeder, faciliteter og eventuelt booke.
            </p>
            <h2 className="font-serif text-xl font-bold text-primary">
              Søg shelters uden GPS
            </h2>
            <p>
              Foretrækker du ikke at dele din placering, kan du bruge{" "}
              <Link href="/soeg" className="text-accent hover:underline">
                søgesiden
              </Link>{" "}
              til at filtrere shelters på region eller område. Du kan også
              udforske{" "}
              <Link href="/omraade" className="text-accent hover:underline">
                shelter efter område
              </Link>{" "}
              for at finde naturovernatning i et bestemt landsdel eller
              nationalpark.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
