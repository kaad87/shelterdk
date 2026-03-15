import { faqToJsonLd } from "@/lib/faq";

interface FaqItem {
  question: string;
  answer: string;
}

interface ArticleFaqProps {
  items: FaqItem[];
  includeSchema?: boolean;
}

export function ArticleFaq({ items, includeSchema = true }: ArticleFaqProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      {includeSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqToJsonLd(items)),
          }}
        />
      )}
      <h2 className="font-serif text-2xl font-bold text-primary mb-6">
        Ofte stillede spørgsmål
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-primary/10 bg-white overflow-hidden"
          >
            <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-primary font-medium hover:bg-primary/[0.02] transition-colors list-none">
              <span>{item.question}</span>
              <span className="ml-4 shrink-0 text-primary/40 group-open:rotate-180 transition-transform duration-200">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </span>
            </summary>
            <div className="px-5 pb-4 text-primary/70 text-sm leading-relaxed border-t border-primary/5 pt-3">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
