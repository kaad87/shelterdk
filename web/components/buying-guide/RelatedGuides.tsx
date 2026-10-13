import Link from "next/link";
import type { HubGuide } from "@/lib/buying-guides-hub";

/**
 * "Se også"-blok med relaterede købsguider.
 *
 * Blokken viser op til seks søskendeguider, men pegede ikke på navet. Målt
 * på det levende site havde /bedste tre kontekstuelle indgående links i alt
 * — navet for 38 guider og 96 % af affiliate-indtægten. Guidesiderne selv
 * nåede det kun gennem brødkrummen og footeren, altså to steder Google
 * vægter som navigation frem for indhold.
 *
 * Linket står sidst og ikke først: læseren skal se de seks relevante forslag,
 * før hun får tilbuddet om at se hele listen. Det er også derfor etiketten
 * nævner antallet — "se alle 38" fortæller hvad der venter, hvor "se alle"
 * ikke gør.
 */
export function RelatedGuides({ guides, ialt }: { guides: HubGuide[]; ialt?: number }) {
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
      <p className="mt-3 text-sm text-primary/80">
        <Link href="/bedste" className="text-accent underline underline-offset-2 hover:text-accent-dark">
          {ialt && ialt > 0 ? `Se alle ${ialt} købsguider` : "Se alle købsguider"}
        </Link>{" "}
        — grej til shelterturen, scoret og rangeret.
      </p>
    </section>
  );
}
