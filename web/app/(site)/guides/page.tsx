import type { Metadata } from "next";
import { getGuides, getGuideCategories } from "@/data/guides";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { GuidesContent } from "@/components/GuidesContent";

const PAGE_TITLE = "Guides til shelters og naturovernatning | ShelterDK";
const PAGE_DESCRIPTION =
  "Få praktiske guides til shelters, udstyr og turplanlægning. Lær hvordan du vælger det rigtige shelter, pakker tasken og får mest muligt ud af overnatning i naturen.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/guides" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guides",
  },
};

export default function GuidesIndexPage() {
  const guides = getGuides();
  const categories = getGuideCategories();

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: "Guides" }]}
      />

      {/* Hero section */}
      <header className="bg-primary text-white py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-white/60 mb-3">
            <span>Hjem</span>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-white/90 font-medium">Guides</span>
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Guides til shelters og naturovernatning
          </h1>
          <p className="text-white/80 max-w-2xl text-base sm:text-lg leading-relaxed">
            Dyk ned i praktiske guides om valg af shelter, pakkelister og tips
            til en god nat i det fri. Siden udbygges løbende, så du altid kan
            finde ny inspiration.
          </p>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <GuidesContent guides={guides} categories={categories} />
      </div>
    </div>
  );
}
