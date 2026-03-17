import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuides, getGuideBySlug } from "@/data/guides";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { renderContent } from "@/lib/renderContent";
import { AuthorBio } from "@/components/AuthorBio";
import { ArticleFaq } from "@/components/ArticleFaq";
import { ShelterCTA } from "@/components/ShelterCTA";
import { ShareExperience } from "@/components/ShareExperience";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: { absolute: "Guide ikke fundet" } };
  const canonicalPath = `/guides/${guide.slug}`;
  return {
    title: { absolute: `${guide.title} | ShelterDK` },
    description: guide.excerpt,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title: `${guide.title} | ShelterDK`,
      description: guide.excerpt,
      url: canonicalPath,
      images: guide.coverImage
        ? [
            {
              url: guide.coverImage,
              width: 1200,
              height: 630,
              alt: guide.title,
            },
          ]
        : undefined,
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const breadcrumbItems = [
    { label: "Hjem", href: "/" },
    { label: "Guides", href: "/guides" },
    { label: guide.title },
  ];

  // Render content and split for inline CTA
  const contentBlocks = renderContent(guide.content);
  const midpoint = Math.floor(contentBlocks.length / 2);
  const firstHalf = contentBlocks.slice(0, midpoint);
  const secondHalf = contentBlocks.slice(midpoint);

  // Related guides from other categories
  const allGuides = getGuides().filter((g) => g.slug !== guide.slug);
  const relatedGuides = allGuides
    .filter((g) => g.category !== guide.category)
    .slice(0, 2);
  const fallbackGuides =
    relatedGuides.length < 2
      ? [...relatedGuides, ...allGuides.filter((g) => g.category === guide.category)].slice(0, 2)
      : relatedGuides;

  const BASE_URL = "https://shelterdk.dk";
  const canonicalPath = `/guides/${guide.slug}`;
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.excerpt,
    image: guide.coverImage,
    author: {
      "@type": "Person",
      name: "Christian",
      url: `${BASE_URL}/om-os`,
    },
    publisher: { "@type": "Organization", name: "ShelterDK", url: BASE_URL },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}${canonicalPath}`,
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema items={breadcrumbItems} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema) }}
      />

      {/* Header with cover image */}
      <header className="relative w-full h-[260px] sm:h-[320px] md:h-[380px] bg-primary text-white overflow-hidden">
        {guide.coverImage && (
          <Image
            src={guide.coverImage}
            alt=""
            fill
            className="object-cover opacity-40"
            sizes="100vw"
            priority
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
        <div className="relative h-full flex items-end">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-10">
            <nav
              className="mb-3 text-sm text-white/80"
              aria-label="Brødkrummesti"
            >
              <ol className="flex flex-wrap items-center gap-1 list-none p-0 m-0">
                <li>
                  <Link
                    href="/"
                    className="hover:text-accent transition-colors"
                  >
                    Hjem
                  </Link>
                </li>
                <li aria-hidden className="mx-1 text-white/60">
                  /
                </li>
                <li>
                  <Link
                    href="/guides"
                    className="hover:text-accent transition-colors"
                  >
                    Guides
                  </Link>
                </li>
                <li aria-hidden className="mx-1 text-white/60">
                  /
                </li>
                <li className="text-white font-semibold truncate max-w-[220px] sm:max-w-none">
                  {guide.title}
                </li>
              </ol>
            </nav>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              {guide.title}
            </h1>
            <p className="mt-3 text-white/90 max-w-2xl text-sm sm:text-base">
              {guide.excerpt}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Guide content — first half */}
        <article className="prose prose-primary max-w-none">
          {firstHalf}
        </article>

        {/* Inline shelter CTA */}
        <ShelterCTA variant="inline" />

        {/* Guide content — second half */}
        <article className="prose prose-primary max-w-none">
          {secondHalf}
        </article>

        {/* Author bio */}
        <div className="mt-12">
          <AuthorBio linkTo="/guides" linkLabel="Se alle guides" />
        </div>

        {/* FAQ section */}
        {guide.faq && guide.faq.length > 0 && (
          <ArticleFaq items={guide.faq} />
        )}

        {/* Share experience */}
        <ShareExperience />

        {/* Full-width shelter CTA */}
        <ShelterCTA variant="full" />

        {/* Related guides */}
        {fallbackGuides.length > 0 && (
          <section className="mt-12 pt-10 border-t border-primary/10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-6">
              Relaterede guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {fallbackGuides.map((related) => (
                <Link
                  key={related.slug}
                  href={`/guides/${related.slug}`}
                  className="group block rounded-xl overflow-hidden border border-primary/10 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={related.coverImage}
                      alt={related.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 50vw"
                      unoptimized
                    />
                    <span className="absolute top-2 left-2 bg-accent text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {related.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif text-base font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-primary/60 text-sm mt-1 line-clamp-2">
                      {related.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
