import { GearSuggestionLink } from "@/components/GearSuggestionLink";
import type { GuideLink } from "@/lib/gear-suggestions";

/**
 * Grej-forslag matchet mod shelterets faciliteter, med link til købsguiderne
 * (/bedste). Vises kun når der er noget at foreslå.
 */
export function GearSuggestions({ guides, shelterSlug }: { guides: GuideLink[]; shelterSlug: string }) {
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
        Vi har sammenlignet og scoret udstyr til netop denne type overnatning.
      </p>
      <ul className="space-y-2">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <GearSuggestionLink guide={guide} shelterSlug={shelterSlug} />
          </li>
        ))}
      </ul>
    </section>
  );
}
