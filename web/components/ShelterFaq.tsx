import type { FaqItem } from "@/lib/faq";

interface ShelterFaqProps {
  items: FaqItem[];
  /** JSON-LD script content (stringified FAQPage schema) – inject in page for SEO */
  jsonLd?: string;
}

export function ShelterFaq({ items, jsonLd }: ShelterFaqProps) {
  if (items.length === 0) return null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <section
        className="mb-10"
        aria-label="Ofte stillede spørgsmål om dette shelter"
        itemScope
        itemType="https://schema.org/FAQPage"
      >
        <h2 className="font-serif text-xl font-bold text-primary mb-4">
          Ofte stillede spørgsmål
        </h2>
        <ul className="space-y-6">
          {items.map((item, index) => (
            <li
              key={index}
              className="rounded-xl border border-primary/10 bg-white/50 p-5"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <h3
                className="font-semibold text-primary mb-2"
                itemProp="name"
              >
                {item.question}
              </h3>
              <div
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <p className="text-primary/90 text-sm leading-relaxed" itemProp="text">
                  {item.answer}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
