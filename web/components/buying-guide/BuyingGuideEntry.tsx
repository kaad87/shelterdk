import Link from "next/link";
import { GearCardView } from "@/components/GearCard";
import { ArrowRight, Check, X } from "lucide-react";
import { rentNavn } from "@/lib/produktnavn";
import type { GuideEntryWithProduct } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";
import { StarRating } from "@/components/buying-guide/StarRating";

/** Pæn label for udvalgte spec-nøgler (fallback = nøglen selv). */
const SPEC_LABELS: Record<string, string> = {
  komfort_temp: "Komforttemp.",
  graense_temp: "Grænsetemp.",
  vaegt_g: "Vægt",
  fyld: "Fyld",
  form: "Form",
  pakmaal: "Pakmål",
  lumen: "Lysstyrke",
  raekkevidde_m: "Rækkevidde",
  genopladelig: "Genopladelig",
  personer: "Personer",
  saeson: "Sæson",
  r_vaerdi: "R-værdi",
  type: "Type",
};

function formatSpec(key: string, val: unknown): string {
  if (key.endsWith("_temp")) return `${val} °C`;
  if (key === "vaegt_g") return `${val} g`;
  if (key === "lumen") return `${val} lm`;
  if (key === "raekkevidde_m") return `${val} m`;
  if (typeof val === "boolean") return val ? "Ja" : "Nej";
  return String(val);
}

export function BuyingGuideEntry({
  entry,
  position,
  produktSlug,
}: {
  entry: GuideEntryWithProduct;
  position: number;
  /**
   * Slug paa varens egen side under /grej. Undefined for de varer der ikke
   * har en, og saa vises linket ikke. Slug'en slaas op i produktIndeks af
   * guidesiden, ikke regnes ud her. Se lib/produktside.ts.
   */
  produktSlug?: string;
}) {
  const { product } = entry;
  const specs = (product.specs ?? {}) as Record<string, unknown>;
  const specEntries = Object.entries(specs).filter(([, v]) => v != null && v !== "");

  return (
    <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {position}
        </span>
        {entry.award_label && (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            {entry.award_label}
          </span>
        )}
        {entry.score != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.04] px-2.5 py-1">
            <span className="text-sm font-bold text-primary">{formatScore(entry.score)}</span>
            <span className="text-xs text-primary/40">/10</span>
            <StarRating score={entry.score} />
          </span>
        )}
        {entry.best_for && (
          <span className="text-xs text-primary/55">Bedst til: {entry.best_for}</span>
        )}
      </div>

      <GearCardView product={product} variant="product" />

      {entry.editorial_note && (
        <p className="mt-3 text-sm leading-relaxed text-primary/80">{entry.editorial_note}</p>
      )}

      {(entry.pros.length > 0 || entry.cons.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ul className="space-y-1">
            {entry.pros.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-primary/80">
                <Check size={15} className="mt-0.5 shrink-0 text-green-600" /> {p}
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {entry.cons.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-primary/60">
                <X size={15} className="mt-0.5 shrink-0 text-red-500" /> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {specEntries.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-primary/5 pt-3 text-xs text-primary/60">
          {specEntries.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium">{SPEC_LABELS[k] ?? k}:</dt>
              <dd>{formatSpec(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {produktSlug && (
        <Link
          href={`/grej/${produktSlug}`}
          // inline-block, ikke inline-flex: produktnavnene brydes over to
          // linjer paa en telefon, og en flex-pil blev efterladt yderst til
          // hoejre i stedet for at foelge det sidste ord.
          className="mt-3 inline-block text-sm font-medium text-accent-dark hover:underline"
        >
          Se pris og vurdering af {rentNavn(product)}
          <ArrowRight size={15} className="ml-1 inline align-[-2px]" />
        </Link>
      )}
    </article>
  );
}
