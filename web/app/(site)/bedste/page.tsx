import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedGuides } from "@/lib/buying-guides";
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

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Bedste" }]} />
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
          </header>

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
