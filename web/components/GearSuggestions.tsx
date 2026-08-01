import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { GuideLink } from "@/lib/gear-suggestions";

/**
 * Grej-forslag matchet mod shelterets faciliteter, med link til købsguiderne
 * (/bedste). Vises kun når der er noget at foreslå.
 */
export function GearSuggestions({ guides }: { guides: GuideLink[] }) {
  if (guides.length === 0) return null;

  return (
    <section
      aria-labelledby="gear-suggestions-heading"
      className="mb-10 rounded-xl border border-accent/15 bg-accent/[0.04] p-5"
    >
      <h2
        id="gear-suggestions-heading"
        className="font-serif text-lg font-bold text-primary mb-1"
      >
        Grej til turen
      </h2>
      <p className="mb-4 text-sm text-primary/70">
        Vi har testet og sammenlignet udstyr til netop denne type overnatning.
      </p>
      <ul className="space-y-2">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/bedste/${guide.slug}`}
              className="group flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2.5 transition-colors hover:bg-white"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-primary group-hover:text-accent transition-colors">
                  {guide.title}
                </span>
                <span className="block text-xs text-primary/55">
                  — {guide.reason}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-accent/60 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
