import Link from "next/link";
import { slugifySegment } from "@/lib/slug";

interface RegionBreakdown {
  region: string;
  count: number;
}

interface DataSummaryBlockProps {
  /** Main stat headline, e.g. "312 shelters med toilet i Danmark" */
  headline: string;
  /** Per-region breakdown (top 3 shown) */
  regionBreakdown?: RegionBreakdown[];
  /** Average Google rating for this segment */
  avgRating?: number | null;
  /** Links to related cross pages */
  crossPageLinks?: { label: string; href: string }[];
}

/**
 * Computed-facts block shown at the top of filter and region pages.
 * Provides citable data summaries that AI bots can extract.
 */
export function DataSummaryBlock({
  headline,
  regionBreakdown,
  avgRating,
  crossPageLinks,
}: DataSummaryBlockProps) {
  const top3 = regionBreakdown?.slice(0, 3) ?? [];

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-8">
      <p className="text-primary font-semibold text-lg mb-2">{headline}</p>
      {top3.length > 0 && (
        <p className="text-primary/80 text-sm mb-2">
          {top3.map((r, i) => (
            <span key={r.region}>
              <Link
                href={`/danmark/${slugifySegment(r.region)}`}
                className="text-accent hover:underline"
              >
                {r.region}
              </Link>
              {" "}({r.count})
              {i < top3.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      )}
      {avgRating != null && (
        <p className="text-primary/70 text-sm">
          Gennemsnitlig Google-bedømmelse: {avgRating} ud af 5.
        </p>
      )}
      {crossPageLinks && crossPageLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {crossPageLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
