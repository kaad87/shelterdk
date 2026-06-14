import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedStayGuides, getStayGuideTeasers } from "@/lib/nature-stays";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const guides = await getPublishedStayGuides();
  return {
    title: { absolute: "Glamping & naturophold i Danmark — kuraterede guider | ShelterDK" },
    description:
      "Håndplukket glamping, naturhytter, domes og træhuse i Danmark. Vores kuraterede guider til luksus i naturen — udvalgt med omhu, ærligt forklaret.",
    alternates: { canonical: "https://shelterdk.dk/naturophold" },
    // Undgå at indeksere en tom hub før der er indhold (tynd-side-beskyttelse).
    ...(guides.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function NatureStaysHubPage() {
  const guides = await getPublishedStayGuides();
  const teasers = await getStayGuideTeasers(guides.map((g) => g.id));

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": "https://shelterdk.dk/naturophold",
    url: "https://shelterdk.dk/naturophold",
    name: "Glamping & naturophold i Danmark",
    inLanguage: "da",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: guides.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: g.title,
        url: `https://shelterdk.dk/naturophold/${g.slug}`,
      })),
    },
  };

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Naturophold" }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70">
            <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-primary">Naturophold</span>
          </nav>

          <header className="mb-8">
            <h1 className="mb-2 font-serif text-3xl font-bold text-primary md:text-4xl">Glamping & naturophold i Danmark</h1>
            <p className="text-lg text-primary/80">
              Håndplukket luksus i naturen — glamping, naturhytter, domes og træhuse. Vil du sove ude uden at gå på kompromis med komforten, er det her.
            </p>
          </header>

          {guides.length === 0 ? (
            <p className="rounded-2xl border border-primary/10 bg-white p-8 text-center text-primary/60">
              Guiderne er på vej — vi kuraterer de bedste naturophold i Danmark lige nu.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {guides.map((g) => {
                const t = teasers.get(g.id);
                return (
                  <Link key={g.id} href={`/naturophold/${g.slug}`} className="block rounded-2xl border border-primary/10 bg-white p-5 transition-colors hover:border-accent/40">
                    <h2 className="font-serif text-xl font-bold text-primary">{g.title}</h2>
                    {g.intro && <p className="mt-1 line-clamp-2 text-sm text-primary/70">{g.intro}</p>}
                    {t && (t.topStayName || t.minPrice != null) && (
                      <p className="mt-3 text-sm text-primary/60">
                        {t.topStayName && <>Topvalg: <span className="font-medium text-primary/80">{t.topStayName}</span></>}
                        {t.minPrice != null && <> · fra {t.minPrice} kr/nat</>}
                        {t.count > 0 && <> · {t.count} steder</>}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
