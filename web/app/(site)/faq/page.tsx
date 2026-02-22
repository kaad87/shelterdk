import type { Metadata } from "next";
import { GLOBAL_FAQS, faqToJsonLd } from "@/lib/faq";

const PAGE_TITLE = "Ofte stillede spørgsmål om shelters i Danmark | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Svar på de mest stillede spørgsmål om shelters: hvad er et shelter, hvor finder jeg dem, er de gratis, kan man booke, toilet og hund. Find shelters i hele Danmark på ShelterDK.",
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Svar på spørgsmål om shelters i Danmark – booking, toilet, hund, gratis overnatning og mere.",
    url: "/faq",
  },
};

export default function FaqPage() {
  const jsonLd = faqToJsonLd(GLOBAL_FAQS);

  return (
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

        <section className="space-y-10" aria-label="FAQ-liste">
          {GLOBAL_FAQS.map((item, index) => (
            <article
              key={index}
              className="border-b border-primary/10 pb-10 last:border-0 last:pb-0"
            >
              <h2 className="font-serif text-xl font-bold text-primary mb-3">
                {item.question}
              </h2>
              <p className="text-primary/90 leading-relaxed">
                {item.answer}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
