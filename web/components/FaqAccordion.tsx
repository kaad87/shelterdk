"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/faq";

interface Props {
  items: FaqItem[];
}

export function FaqAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="space-y-0 divide-y divide-primary/10" aria-label="FAQ-liste">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <article key={index} className="py-0">
            <button
              type="button"
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left group"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${index}`}
            >
              <h2 className="font-serif text-xl font-bold text-primary group-hover:text-accent transition-colors">
                {item.question}
              </h2>
              <ChevronDown
                size={20}
                className={`shrink-0 text-primary/40 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            <div
              id={`faq-answer-${index}`}
              role="region"
              aria-labelledby={`faq-question-${index}`}
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-primary/90 leading-relaxed pb-5">
                  {item.answer}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
