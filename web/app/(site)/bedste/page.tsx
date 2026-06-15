import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedGuides, getGuideTeasers } from "@/lib/buying-guides";
import { hasPublishedStayGuides } from "@/lib/nature-stays";
import { groupGuides } from "@/lib/buying-guides-hub";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Bedste outdoor-grej — købsguider | ShelterDK" },
  description:
    "Vores købsguider til outdoor-grej: bedste sovepose, telt, pandelampe og mere. Rangeret på specs, pris og friluftserfaring — uvildigt forklaret.",
  alternates: { canonical: "https://shelterdk.dk/bedste" },
};

export default async function BuyingGuidesIndexPage() {
  const guides = await getPublishedGuides();
  const teasers = await getGuideTeasers(guides.map((g) => g.id));
  const showStays = await hasPublishedStayGuides().catch(() => false);

  // CollectionPage + ItemList over guides → fortæller Google at hubben er
  // den kuraterede indgang til købsguide-klyngen.
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": "https://shelterdk.dk/bedste",
    url: "https://shelterdk.dk/bedste",
    name: "Bedste outdoor-grej — købsguider",
    inLanguage: "da",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: guides.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: `https://shelterdk.dk/bedste/${g.slug}`,
      })),
    },
  };

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Bedste" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70">
            <Link href="/" className="hover:text-accent transition-colors">
              Hjem
            </Link>
            <span aria-hidden="true">›</span>
            <span className="text-primary font-medium">Bedste</span>
          </nav>

          <header className="mb-8">
            <h1 className="mb-2 font-serif text-3xl font-bold text-primary md:text-4xl">
              Bedste outdoor-grej
            </h1>
            <p className="text-lg text-primary/80">
              Vores købsguider — rangeret på specs, pris og friluftserfaring.{" "}
              <Link href="/saadan-vurderer-vi" className="text-accent underline">
                Sådan vurderer vi
              </Link>
              .
            </p>
            {showStays && (
              <p className="mt-3 text-sm text-primary/60">
                Leder du efter luksus i naturen i stedet for grej? Se vores{" "}
                <Link href="/naturophold" className="font-medium text-accent hover:underline">glamping- &amp; naturophold-guider</Link>.
              </p>
            )}
          </header>

          <section className="mb-10 rounded-2xl border border-primary/10 bg-white p-6">
            <h2 className="mb-3 font-serif text-xl font-bold text-primary">
              Sådan arbejder vores købsguider
            </h2>
            <p className="text-sm leading-relaxed text-primary/80">
              Hver guide scorer 6–8 udvalgte produkter på en 10-skala ud fra specs
              (temperatur, vægt, R-værdi, lumen), pris og hvor godt de passer til
              shelterture i dansk klima. Vi viser åbent plusser og minusser for
              hvert produkt, og priser og lagerstatus opdateres automatisk fra
              forhandlerne hver dag. Links til forhandlere er affiliate-links —{" "}
              <Link href="/annoncer-og-partnere" className="text-accent underline">
                læs hvordan det finansierer sitet
              </Link>{" "}
              uden at påvirke rangeringen. Den fulde metode står i{" "}
              <Link href="/saadan-vurderer-vi" className="text-accent underline">
                Sådan vurderer vi
              </Link>
              . Jagter du nedsat grej, er{" "}
              <Link href="/tilbud" className="text-accent underline">
                ugens bedste outdoor-tilbud
              </Link>{" "}
              samlet ét sted.
            </p>
          </section>

          {guides.length === 0 ? (
            <p className="py-8 text-primary/70">Der er ingen købsguider endnu.</p>
          ) : (
            <div className="space-y-10">
              {groupGuides(guides).map((section) => (
                <section key={section.group}>
                  <h2 className="mb-4 font-serif text-2xl font-bold text-primary">
                    {section.group}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {section.guides.map((g) => (
                      <Link
                        key={g.slug}
                        href={`/bedste/${g.slug}`}
                        className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm transition-transform hover:scale-[1.01]"
                      >
                        <h3 className="font-serif text-lg font-bold text-primary">{g.title}</h3>
                        {g.intro && (
                          <p className="mt-1 line-clamp-2 text-sm text-primary/70">{g.intro}</p>
                        )}
                        {(() => {
                          const t = teasers.get(g.id);
                          if (!t?.winnerName) return null;
                          return (
                            <p className="mt-2 text-xs text-primary/60">
                              <span className="font-semibold text-primary">Testvinder:</span>{" "}
                              {t.winnerName}
                              {t.winnerScore != null && (
                                <span className="ml-1 font-semibold text-accent">{String(t.winnerScore).replace(".", ",")}/10</span>
                              )}
                              {t.minPrice != null && (
                                <span className="ml-1 text-primary/45">· fra {Math.round(t.minPrice).toLocaleString("da-DK")} kr.</span>
                              )}
                            </p>
                          );
                        })()}
                        <span className="mt-3 inline-block text-sm font-medium text-accent">
                          Se guiden →
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
