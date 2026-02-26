import type { FaqItem } from "@/lib/faq";

interface AreaFaqProps {
  areaName: string;
  items: FaqItem[];
  jsonLd?: string;
}

export function AreaFaq({ areaName, items, jsonLd }: AreaFaqProps) {
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
        className="mt-12 pt-10 border-t border-primary/10"
        aria-labelledby="area-faq-heading"
      >
        <div className="max-w-3xl">
          <h2 className="font-serif text-2xl font-bold text-primary mb-3">
            Praktisk info om friluftsliv på {areaName}
          </h2>
          <p className="text-primary/80 text-sm sm:text-base mb-8">
            Her kan du læse generelle svar på typiske spørgsmål om shelters og
            friluftsliv i området. Informationen er vejledende og kan variere
            fra plads til plads – se altid den enkelte shelterside for detaljer.
          </p>
        </div>

        <div className="max-w-3xl">
          <h3
            id="area-faq-heading"
            className="font-serif text-xl font-bold text-primary mb-4"
          >
            Ofte stillede spørgsmål om shelters på {areaName}
          </h3>
          <ul className="space-y-4">
            {items.map((item, index) => (
              <li
                key={index}
                className="rounded-xl border border-primary/10 bg-white/70 p-4"
              >
                <h4 className="font-semibold text-primary mb-1">
                  {item.question}
                </h4>
                <p className="text-primary/90 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

