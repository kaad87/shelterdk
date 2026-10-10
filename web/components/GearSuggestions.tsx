import { GearBlockImpression } from "@/components/GearBlockImpression";
import { GearSuggestionLink } from "@/components/GearSuggestionLink";
import type { GuideLink } from "@/lib/gear-suggestions";

/**
 * Grej-forslag matchet mod shelterets faciliteter, med link til købsguiderne
 * (/bedste). Vises kun når der er noget at foreslå.
 *
 * Blokken sidder nu lige under Faciliteter. Den lå før seks sektioner længere
 * ned og fik ét klik på otte dages måling — men kun 4,4% af de 7255 månedlige
 * visninger på shelter-siderne scroller så dybt, så den blev næsten aldrig
 * set. Faciliteter er samtidig det rigtige sted: forslagene UDLEDES af dem,
 * så "der er ikke vand på pladsen" står nu få linjer under selve faciliteten.
 *
 * Fladen er også gjort tydeligere. Den havde en 4%-tonet baggrund, altså
 * stort set usynlig, og lignede to andre sektioner på siden.
 */
export function GearSuggestions({ guides, shelterSlug }: { guides: GuideLink[]; shelterSlug: string }) {
  if (guides.length === 0) return null;

  return (
    <section
      aria-labelledby="gear-suggestions-heading"
      className="mb-10 rounded-xl border border-accent/30 bg-accent/[0.07] p-5"
    >
      <GearBlockImpression shelterSlug={shelterSlug} guideCount={guides.length} />
      <h2
        id="gear-suggestions-heading"
        className="font-serif text-lg font-bold text-primary mb-1"
      >
        Grej til netop denne plads
      </h2>
      <p className="mb-4 text-sm text-primary/70">
        Valgt ud fra faciliteterne ovenfor. Vi har scoret og prissat
        produkterne i {guides.length === 1 ? "guiden" : "hver guide"}.
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
