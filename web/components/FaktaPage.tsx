// web/components/FaktaPage.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { DatasetSchema } from "@/components/seo/DatasetSchema";
import { ShelterCard } from "@/components/ShelterCard";
import { InstagramFeed } from "@/components/InstagramFeed";
import { getSitePageModified } from "@/lib/content-dates";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { slugifySegment } from "@/lib/slug";
import type { Shelter } from "@/types/shelter";

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

interface BreakdownRow {
  label: string;
  value: number | string;
  href?: string;
}

interface RelatedLink {
  label: string;
  href: string;
}

interface FaktaPageProps {
  title: string;
  heroStat: string;
  summary: string;
  breakdownTitle: string;
  breakdownRows: BreakdownRow[];
  topSheltersTitle: string;
  topShelters: Shelter[];
  faqItems: FaqItem[];
  relatedLinks: RelatedLink[];
  datasetName: string;
  datasetDescription: string;
  canonicalPath: string;
  variableMeasured?: string[];
  children?: React.ReactNode;
}

export function FaktaPage({
  title,
  heroStat,
  summary,
  breakdownTitle,
  breakdownRows,
  topSheltersTitle,
  topShelters,
  faqItems,
  relatedLinks,
  datasetName,
  datasetDescription,
  canonicalPath,
  variableMeasured,
  children,
}: FaktaPageProps) {
  const datasetDateModified = getSitePageModified(canonicalPath);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Fakta", href: "/fakta" },
          { label: title },
        ]}
      />
      <DatasetSchema
        name={datasetName}
        description={datasetDescription}
        url={`https://shelterdk.dk${canonicalPath}`}
        dateModified={datasetDateModified}
        variableMeasured={variableMeasured}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Hjem
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/fakta" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Fakta
            </Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">{title}</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              {title}
            </h1>
            <p className="text-accent font-semibold text-xl mb-3">{heroStat}</p>
            <p className="text-primary/80 text-lg leading-relaxed">{summary}</p>
          </header>

          {/* Breakdown table */}
          <section className="mb-12">
            <h2 className="font-serif text-xl font-bold text-primary mb-4">{breakdownTitle}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-primary/10">
                    <th className="py-2 pr-4 text-sm font-semibold text-primary/70">Navn</th>
                    <th className="py-2 text-sm font-semibold text-primary/70 text-right">Antal</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr key={row.label} className="border-b border-primary/5">
                      <td className="py-2 pr-4 text-sm text-primary">
                        {row.href ? (
                          <Link href={row.href} className="text-accent hover:underline">
                            {row.label}
                          </Link>
                        ) : (
                          row.label
                        )}
                      </td>
                      <td className="py-2 text-sm text-primary font-medium text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top shelters */}
          {topShelters.length > 0 && (
            <section className="mb-12">
              <h2 className="font-serif text-xl font-bold text-primary mb-4">{topSheltersTitle}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topShelters.map((shelter) => (
                  <ShelterCard
                    key={shelter.id}
                    shelter={shelter}
                    href={shelterHref(shelter.region ?? null, shelter.kommune ?? null, shelter.slug)}
                  />
                ))}
              </div>
            </section>
          )}

          {children}

          <InstagramFeed title="Shelter-stemning fra Instagram" className="mt-12" />

          {/* FAQ */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål
            </h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }}
            />
          </section>

          {/* Related links */}
          <section className="mt-10 pt-6 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Læs mere</h2>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
