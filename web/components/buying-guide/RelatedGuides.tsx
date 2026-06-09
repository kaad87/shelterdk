import Link from "next/link";
import type { HubGuide } from "@/lib/buying-guides-hub";

/** "Se også"-blok med relaterede købsguider (intern linkning). */
export function RelatedGuides({ guides }: { guides: HubGuide[] }) {
  if (!guides || guides.length === 0) return null;
  return (
    <section className="mt-10 border-t border-primary/10 pt-6">
      <h2 className="mb-3 font-serif text-xl font-bold text-primary">Se også</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/bedste/${g.slug}`}
              className="block rounded-lg border border-primary/10 px-3 py-2 text-sm text-primary hover:border-accent/30 hover:text-accent transition-colors"
            >
              {g.title} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
