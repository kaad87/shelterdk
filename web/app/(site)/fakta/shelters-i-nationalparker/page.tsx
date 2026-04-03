import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { DatasetSchema } from "@/components/seo/DatasetSchema";
import { ShelterCard } from "@/components/ShelterCard";
import { faqToJsonLd } from "@/lib/faq";
import { getSheltersInNationalParks } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;
const CANONICAL = "/fakta/shelters-i-nationalparker";

export const metadata: Metadata = {
  title: { absolute: "Shelters i nationalparker \u2013 Danmarks 5 nationalparker | ShelterDK" },
  description: "Find shelters i Danmarks 5 nationalparker: Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land og Kongernes Nordsj\u00e6lland.",
  alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
  openGraph: {
    title: "Shelters i nationalparker \u2013 Danmarks 5 nationalparker | ShelterDK",
    description: "Find shelters i Danmarks 5 nationalparker.",
    url: CANONICAL,
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

export default async function NationalparkerPage() {
  const parkData = await getSheltersInNationalParks();
  const totalInParks = parkData.reduce((sum, p) => sum + p.shelters.length, 0);

  const faqItems = [
    { question: "Hvor mange shelters er der i Danmarks nationalparker?", answer: `Der er ca. ${totalInParks} shelters i eller n\u00e6r Danmarks 5 nationalparker.` },
    { question: "Hvilken nationalpark har flest shelters?", answer: parkData.length > 0 ? `${parkData.sort((a, b) => b.shelters.length - a.shelters.length)[0].parkName} har flest med ${parkData[0].shelters.length} shelters.` : "Data er ikke tilg\u00e6ngelig." },
    { question: "Er shelters i nationalparker gratis?", answer: "Mange shelters i nationalparker er gratis (f\u00f8rst-til-m\u00f8lle). Nogle kan bookes via udinaturen.dk." },
    { question: "Hvilke nationalparker er der i Danmark?", answer: "Danmark har 5 nationalparker: Nationalpark Thy, Nationalpark Mols Bjerge, Nationalpark Vadehavet, Nationalpark Skjoldungernes Land og Nationalpark Kongernes Nordsj\u00e6lland." },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Fakta", href: "/fakta/shelters-i-danmark" }, { label: "Nationalparker" }]} />
      <DatasetSchema
        name="Shelters i Danmarks nationalparker"
        description={`${totalInParks} shelters fordelt p\u00e5 Danmarks 5 nationalparker`}
        url={`https://shelterdk.dk${CANONICAL}`}
        variableMeasured={["shelter count per national park"]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/fakta/shelters-i-danmark" className="py-1 -my-1 hover:text-accent transition-colors">Fakta</Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">Nationalparker</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">Shelters i Danmarks nationalparker</h1>
            <p className="text-accent font-semibold text-xl mb-3">Ca. {totalInParks} shelters i 5 nationalparker</p>
            <p className="text-primary/80 text-lg leading-relaxed">
              Danmark har 5 nationalparker med sheltermuligheder. Her er en oversigt over shelters i og n&#230;r hver nationalpark.
            </p>
          </header>

          {parkData
            .sort((a, b) => b.shelters.length - a.shelters.length)
            .map((park) => (
            <section key={park.parkSlug} className="mb-12">
              <h2 className="font-serif text-xl font-bold text-primary mb-2">{park.parkName}</h2>
              <p className="text-primary/70 text-sm mb-4">{park.shelters.length} shelters</p>
              {park.shelters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {park.shelters.slice(0, 6).map((s) => (
                    <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                  ))}
                </div>
              ) : (
                <p className="text-primary/60 text-sm">Ingen shelters fundet i dette omr\u00e5de.</p>
              )}
            </section>
          ))}

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">Ofte stillede sp\u00f8rgsm\u00e5l</h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
          </section>

          <section className="mt-10 pt-6 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">L&#230;s mere</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/fakta/shelters-i-danmark" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Shelters i Danmark</Link>
              <Link href="/guides/shelter-i-nationalparker" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Guide: Nationalparker</Link>
              <Link href="/fakta/bedste-shelters" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Bedste shelters</Link>
              <Link href="/fakta/gratis-shelters" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Gratis shelters</Link>
              <Link href="/blog/de-bedste-regioner" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Bedste regioner for shelterture</Link>
              <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Begynderguide</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
