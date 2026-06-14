import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStayGuideBySlug, getPublishedStayGuideSlugs } from "@/lib/nature-stays";
import { StayCard } from "@/components/naturophold/StayCard";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { renderContent } from "@/lib/renderContent";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { newestIsoDate } from "@/lib/content-dates";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getPublishedStayGuideSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStayGuideBySlug(slug);
  if (!data) return { title: "Ikke fundet | ShelterDK" };
  const { guide } = data;
  return {
    title: { absolute: guide.seo_title ?? `${guide.title} | ShelterDK` },
    description: guide.seo_description ?? guide.intro ?? undefined,
    alternates: { canonical: `https://shelterdk.dk/naturophold/${guide.slug}` },
  };
}

export default async function NatureStayGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStayGuideBySlug(slug);
  if (!data) notFound();
  const { guide, entries } = data;
  const body = guide.body_md ? await renderContent(guide.body_md) : null;
  const pageUrl = `https://shelterdk.dk/naturophold/${guide.slug}`;
  const dateModified = newestIsoDate(guide.last_reviewed_at, guide.updated_at) ?? guide.updated_at;
  const top = entries[0]?.stay;
  const faqItems: FaqItem[] = (guide.faq ?? []).map((f) => ({ question: f.q, answer: f.a }));

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": pageUrl,
    url: pageUrl,
    name: guide.title,
    inLanguage: "da",
    datePublished: guide.created_at,
    dateModified,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "LodgingBusiness",
          name: e.stay.name,
          ...(e.stay.image_url ? { image: e.stay.image_url } : {}),
          ...(e.stay.price_from != null ? { priceRange: `fra ${e.stay.price_from} kr` } : {}),
          address: {
            "@type": "PostalAddress",
            ...(e.stay.place ? { addressLocality: e.stay.place } : {}),
            ...(e.stay.region ? { addressRegion: e.stay.region } : {}),
            addressCountry: "DK",
          },
        },
      })),
    },
  };

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Naturophold", href: "/naturophold" }, { label: guide.title }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
      )}

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70">
            <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
            <span aria-hidden="true">›</span>
            <Link href="/naturophold" className="hover:text-accent transition-colors">Naturophold</Link>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-primary">{guide.title}</span>
          </nav>

          <h1 className="mb-2 font-serif text-3xl font-bold text-primary md:text-4xl">{guide.title}</h1>
          {guide.intro && <p className="text-lg text-primary/80">{guide.intro}</p>}
          <p className="mt-2 text-xs text-primary/50">
            {guide.author && <>Af {guide.author} · </>}
            {guide.last_reviewed_at && <>Sidst opdateret {new Date(guide.last_reviewed_at).toLocaleDateString("da-DK")} · </>}
            Vi kan tjene en kommission, hvis du booker via et link — det påvirker ikke vores vurdering.
          </p>

          {top && (
            <div className="mt-6 rounded-2xl border border-primary/10 bg-white p-5">
              <h2 className="font-serif text-lg font-bold text-primary">Hurtigt svar</h2>
              <p className="mt-1 text-primary/80">
                Vores topvalg er <span className="font-semibold">{top.name}</span>
                {top.price_from != null && <> (fra {top.price_from} kr/nat)</>}
                {top.region && <> i {top.region}</>}.
              </p>
            </div>
          )}

          {entries.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {entries.map((e) => (
                <StayCard key={e.id} stay={e.stay} awardLabel={e.award_label} bestFor={e.best_for} editorialNote={e.editorial_note} position="naturophold_guide" />
              ))}
            </div>
          )}

          {body && <article className="prose prose-stone mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: body }} />}

          {guide.faq && guide.faq.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-serif text-2xl font-bold text-primary">Ofte stillede spørgsmål</h2>
              <div className="space-y-4">
                {guide.faq.map((f, i) => (
                  <div key={i} className="rounded-xl border border-primary/10 bg-white p-4">
                    <h3 className="font-semibold text-primary">{f.q}</h3>
                    <p className="mt-1 text-primary/80">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-8">
            <LastVerifiedBadge isoDate={guide.last_reviewed_at} />
          </div>
        </div>
      </div>
    </>
  );
}
