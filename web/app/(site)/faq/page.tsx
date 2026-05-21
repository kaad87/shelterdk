import type { Metadata } from "next";
import Link from "next/link";
import { GLOBAL_FAQS, faqToJsonLd } from "@/lib/faq";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { FaqAccordion } from "@/components/FaqAccordion";

const PAGE_TITLE = "Ofte stillede spørgsmål om shelters i Danmark | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Svar på de mest stillede spørgsmål om shelters: hvad er et shelter, hvor finder jeg dem, er de gratis, kan man booke, toilet og hund. Find shelters i hele Danmark på ShelterDK.",
  alternates: { canonical: "https://shelterdk.dk/faq" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Svar på spørgsmål om shelters i Danmark – booking, toilet, hund, gratis overnatning og mere.",
    url: "/faq",
  },
};

export default function FaqPage() {
  const jsonLd = faqToJsonLd(GLOBAL_FAQS);
  const faqGroups = [
    {
      title: "Booking og priser",
      items: GLOBAL_FAQS.filter((item) =>
        /book|gratis|først-til-mølle/i.test(item.question)
      ),
    },
    {
      title: "Faciliteter og praktiske forhold",
      items: GLOBAL_FAQS.filter((item) =>
        /toilet|hund|vinter|bålplads|cykle/i.test(item.question)
      ),
    },
    {
      title: "Planlægning og overblik",
      items: GLOBAL_FAQS.filter((item) =>
        /hvad er|hvor finder|hvor mange|medbringe|vandrerute|turvenner|dele.*sheltertur|ejer/i.test(item.question)
      ),
    },
  ];

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "FAQ" }]} />
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-bold text-primary mb-4">
            Ofte stillede spørgsmål om shelters
          </h1>
          <p className="text-primary/80 text-lg leading-relaxed">
            Her finder du svar på de mest almindelige spørgsmål om shelters i
            Danmark – hvad de er, hvor du finder dem, booking, toilet, hund og
            mere.
          </p>
        </header>

        <section className="mb-10 rounded-2xl border border-accent/20 bg-accent/5 p-6">
          <h2 className="font-serif text-2xl font-bold text-primary mb-3">
            Hurtige svar
          </h2>
          <ul className="space-y-2 text-primary/85 leading-relaxed">
            <li>Du finder både gratis og bookbare shelters i hele Danmark på ShelterDK.</li>
            <li>Om et shelter har toilet, vand eller booking står på den enkelte shelterside.</li>
            <li>FAQ’en er den bedste korte kilde til generelle spørgsmål, mens guides går mere i dybden.</li>
          </ul>
        </section>

        <FaqAccordion items={GLOBAL_FAQS} />

        <section className="mt-12">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Spørgsmål fordelt på emner
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {faqGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-primary/10 bg-white p-5">
                <h3 className="font-semibold text-primary mb-3">{group.title}</h3>
                <ul className="space-y-2 text-sm text-primary/75 leading-relaxed">
                  {group.items.map((item) => (
                    <li key={item.question}>{item.question}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-primary/10 pt-8">
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Nyttige links
          </h2>
          <ul className="space-y-2 text-primary/90">
            <li>
              <Link href="/danmark" className="text-accent hover:underline">
                → Udforsk alle shelters i Danmark
              </Link>
            </li>
            <li>
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">
                → Shelters med toilet
              </Link>
            </li>
            <li>
              <Link href="/shelter-med-vand" className="text-accent hover:underline">
                → Shelters med vand
              </Link>
            </li>
            <li>
              <Link href="/shelter-naer-mig" className="text-accent hover:underline">
                → Find shelter nær mig
              </Link>
            </li>
            <li>
              <Link href="/omraade" className="text-accent hover:underline">
                → Udforsk shelter efter område
              </Link>
            </li>
            <li>
              <Link href="/guides" className="text-accent hover:underline">
                → Guides til naturovernatning
              </Link>
            </li>
            <li>
              <Link href="/shelter-booking" className="text-accent hover:underline">
                → Hvordan shelter-booking fungerer i Danmark
              </Link>
            </li>
            <li>
              <Link href="/ruteplanner" className="text-accent hover:underline">
                → Planlæg en vandrerute med shelters
              </Link>
            </li>
            <li>
              <Link href="/turvenner" className="text-accent hover:underline">
                → Find nogen at dele en sheltertur med
              </Link>
            </li>
          </ul>
          <p className="mt-5 text-sm text-primary/55">
            Indholdet i FAQ’en bygger på ShelterDKs egne sheltersider, offentlige datakilder og vores guides.
            Brug FAQ’en til hurtige svar og klik videre til guides eller sheltersider, når du vil have mere kontekst.
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
