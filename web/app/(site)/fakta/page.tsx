import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Fakta om shelters i Danmark | ShelterDK" },
  description:
    "Udforsk ShelterDKs faktaunivers med statistik om shelters i Danmark, gratis shelters, faciliteter, nationalparker og de bedst bedømte pladser.",
  alternates: { canonical: "https://shelterdk.dk/fakta" },
  openGraph: {
    title: "Fakta om shelters i Danmark | ShelterDK",
    description:
      "Fakta og statistik om shelters i Danmark: antal, faciliteter, gratis shelters og nationalparker.",
    url: "/fakta",
  },
};

const faktaLinks = [
  {
    href: "/fakta/shelters-i-danmark",
    title: "Shelters i Danmark",
    description: "Overblik over antal shelters, regioner og topplaceringer.",
  },
  {
    href: "/fakta/gratis-shelters",
    title: "Gratis shelters",
    description: "Se hvor mange shelters der er gratis, og hvor de findes.",
  },
  {
    href: "/fakta/shelters-med-faciliteter",
    title: "Shelters med faciliteter",
    description: "Toilet, vand, bålplads og andre praktiske forhold.",
  },
  {
    href: "/fakta/bedste-shelters",
    title: "Bedste shelters",
    description: "De bedst bedømte shelters baseret på anmeldelsesdata.",
  },
  {
    href: "/fakta/shelters-i-nationalparker",
    title: "Shelters i nationalparker",
    description: "Shelters tæt på Danmarks nationalparker og naturområder.",
  },
];

export default function FaktaHubPage() {
  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Fakta" }]} />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-8 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li>
                <Link href="/" className="hover:text-accent transition-colors">
                  Forside
                </Link>
              </li>
              <li aria-hidden className="text-primary/50">/</li>
              <li className="text-primary font-medium">Fakta</li>
            </ol>
          </nav>

          <header className="mb-10 max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
              Fakta om shelters i Danmark
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Brug faktauniverset som hub for data, statistik og overblik. Herfra kan du gå
              videre til sider om antal shelters, gratis pladser, faciliteter, nationalparker og
              de bedst bedømte shelters.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faktaLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm hover:border-accent/30 hover:shadow-md transition-all"
              >
                <h2 className="font-serif text-2xl font-bold text-primary">{item.title}</h2>
                <p className="mt-2 text-primary/70">{item.description}</p>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
