import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGuideCategories,
  getGuideCategoryDescription,
  getGuides,
  type GuideCategory,
} from "@/data/guides";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { GuidesContent } from "@/components/GuidesContent";
import { slugifySegment } from "@/lib/slug";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getCategoryBySlug(slug: string): GuideCategory | undefined {
  return getGuideCategories().find((category) => slugifySegment(category) === slug);
}

export function generateStaticParams() {
  return getGuideCategories().map((category) => ({
    slug: slugifySegment(category),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) {
    return { title: { absolute: "Kategori ikke fundet | ShelterDK" } };
  }

  const guides = getGuides().filter((guide) => guide.category === category);
  const description = getGuideCategoryDescription(category);
  const canonicalPath = `/guides/kategori/${slug}`;

  return {
    title: { absolute: `Guides om ${category} | ShelterDK` },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title: `Guides om ${category} | ShelterDK`,
      description,
      url: canonicalPath,
      images: guides[0]
        ? [{ url: guides[0].coverImage, width: 1200, height: 630, alt: guides[0].title }]
        : undefined,
    },
  };
}

export default async function GuideCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const guides = getGuides().filter((guide) => guide.category === category);
  const description = getGuideCategoryDescription(category);
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `ShelterDK Guides: ${category}`,
    description,
    url: `https://shelterdk.dk/guides/kategori/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: guides.map((guide, index) => ({
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
        items={[
          { label: "Hjem", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: category },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <header className="bg-primary text-white py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-white/60 mb-3">
            <span>Hjem</span>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span>Guides</span>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-white/90 font-medium">{category}</span>
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Guides om {category.toLowerCase()}
          </h1>
          <p className="text-white/80 max-w-2xl text-base sm:text-lg leading-relaxed">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/guides" className="text-white/90 hover:text-white underline-offset-4 hover:underline">
              Se alle guides
            </Link>
            <Link href="/blog" className="text-white/90 hover:text-white underline-offset-4 hover:underline">
              Suppler med blogindlæg
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <GuidesContent
          guides={guides}
          categories={getGuideCategories()}
          activeCategory={category}
        />
      </div>
    </div>
  );
}
