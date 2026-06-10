import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuideBySlug, getPublishedGuideSlugs, getPublishedGuides } from "@/lib/buying-guides";
import { relatedGuides } from "@/lib/buying-guides-hub";
import { RelatedGuides } from "@/components/buying-guide/RelatedGuides";
import { buildItemListSchema } from "@/lib/buying-guides-schema";
import { BuyingGuideEntry } from "@/components/buying-guide/BuyingGuideEntry";
import { BuyingGuideOverview } from "@/components/buying-guide/BuyingGuideOverview";
import { BuyingGuideComparisonTable } from "@/components/buying-guide/BuyingGuideComparisonTable";
import { BuyingGuideSources } from "@/components/buying-guide/BuyingGuideSources";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { formatScore } from "@/lib/buying-guides-score";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { renderContent } from "@/lib/renderContent";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getPublishedGuideSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getGuideBySlug(params.slug);
  if (!data) return {};
  const { guide } = data;
  return {
    title: { absolute: guide.seo_title || guide.title },
    description: guide.seo_description ?? guide.intro ?? undefined,
    alternates: { canonical: `https://shelterdk.dk/bedste/${guide.slug}` },
    openGraph: {
      images: [DEFAULT_OG_IMAGE],
      title: guide.seo_title || guide.title,
      description: guide.seo_description ?? guide.intro ?? undefined,
      url: `/bedste/${guide.slug}`,
    },
  };
}

export default async function BuyingGuidePage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getGuideBySlug(params.slug);
  if (!data) notFound();
  const { guide, entries } = data;
  const allGuides = await getPublishedGuides();
  const related = relatedGuides(guide.slug, allGuides);
  const parent = guide.parent_slug ? allGuides.find((x) => x.slug === guide.parent_slug) ?? null : null;
  const pageUrl = `https://shelterdk.dk/bedste/${guide.slug}`;
  const itemList = buildItemListSchema(
    entries.map((e) => ({ product: e.product, score: e.score })),
    pageUrl
  );
  const faqItems: FaqItem[] = (guide.faq ?? []).map((f) => ({ question: f.q, answer: f.a }));

  // GEO-svarkapsel: kort, citerbar anbefaling bygget fra testvinderen + et budgetvalg.
  const topPick = entries[0] ?? null;
  const budgetPick = entries.find((e) => /budget|pris/i.test(e.award_label ?? "")) ?? null;
  const answerText = topPick
    ? `Vores testvinder er ${topPick.product.product_name}${topPick.score != null ? ` (${formatScore(topPick.score)}/10)` : ""} — det bedste alround-valg.${budgetPick && budgetPick.id !== topPick.id ? ` Bedst til prisen: ${budgetPick.product.product_name}.` : ""}`
    : guide.intro ?? "";
  const body = guide.body_md ? await renderContent(guide.body_md) : null;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Bedste", href: "/bedste" },
          ...(parent ? [{ label: parent.title, href: `/bedste/${parent.slug}` }] : []),
          { label: guide.title },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      {faqItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }}
        />
      )}

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70">
            <Link href="/" className="hover:text-accent transition-colors">
              Hjem
            </Link>
            <span aria-hidden="true">›</span>
            <Link href="/bedste" className="hover:text-accent transition-colors">
              Bedste
            </Link>
            <span aria-hidden="true">›</span>
            {parent && (
              <>
                <Link
                  href={`/bedste/${parent.slug}`}
                  className="hover:text-accent transition-colors"
                >
                  {parent.title}
                </Link>
                <span aria-hidden="true">›</span>
              </>
            )}
            <span className="text-primary font-medium">{guide.title}</span>
          </nav>

          <h1 className="mb-2 font-serif text-3xl font-bold text-primary md:text-4xl">
            {guide.title}
          </h1>
          {guide.intro && <p className="text-lg text-primary/80">{guide.intro}</p>}
          <p className="mt-2 text-xs text-primary/50">
            {guide.author && <>Af {guide.author} · </>}
            {guide.last_reviewed_at && (
              <>Sidst opdateret {new Date(guide.last_reviewed_at).toLocaleDateString("da-DK")} · </>
            )}
            <Link href="/saadan-vurderer-vi" className="underline hover:text-accent">
              Sådan vurderer vi
            </Link>
          </p>

          {/* GEO-svarkapsel */}
          {answerText && (
            <div className="mt-6">
              <QuickAnswer url={pageUrl} heading="Hurtigt svar" answer={answerText} />
            </div>
          )}

          {/* Hurtigt overblik (top-picks) + sammenligningstabel */}
          <BuyingGuideOverview entries={entries} />
          <BuyingGuideComparisonTable entries={entries} />

          {/* Rangeret liste */}
          <div className="mt-8 space-y-5">
            {entries.map((e, i) => (
              <BuyingGuideEntry key={e.id} entry={e} position={i + 1} />
            ))}
          </div>

          {/* Lang købsguide-brødtekst (SEO-motor) */}
          {body && <div className="prose prose-primary mt-12 max-w-none">{body}</div>}

          {/* Kilder */}
          <BuyingGuideSources sources={guide.sources} />

          {/* FAQ */}
          {faqItems.length > 0 && (
            <section className="mt-10 border-t border-primary/10 pt-6">
              <h2 className="mb-3 font-serif text-xl font-bold text-primary">
                Ofte stillede spørgsmål
              </h2>
              <div className="space-y-4">
                {faqItems.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-primary">{f.question}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-primary/80">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Se også — relaterede guider */}
          <RelatedGuides guides={related} />

          {/* Disclosure */}
          <p className="mt-10 rounded-lg bg-primary/[0.03] p-4 text-xs text-primary/50">
            shelterdk anbefaler grej fra vores partnere og tjener en kommission når du handler via
            vores links. Det påvirker ikke prisen for dig. Vi labtester ikke selv —{" "}
            <Link href="/saadan-vurderer-vi" className="underline">
              se hvordan vi vurderer
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
