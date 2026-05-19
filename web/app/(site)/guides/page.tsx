import type { Metadata } from "next";
import Link from "next/link";
import { getGuideCategories, getGuides } from "@/data/guides";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { GuidesContent } from "@/components/GuidesContent";
import { slugifySegment } from "@/lib/slug";

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
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ShelterDK Guides",
    description: PAGE_DESCRIPTION,
    url: "https://shelterdk.dk/guides",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: guides.slice(0, 12).map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://shelterdk.dk/guides/${guide.slug}`,
        name: guide.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: "Guides" }]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
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
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/guides/kategori/${slugifySegment(category)}`}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/15 transition-colors"
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <GuidesContent guides={guides} categories={categories} />
      </div>
    </div>
  );
}
