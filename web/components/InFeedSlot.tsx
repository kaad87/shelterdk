import { AdInFeed } from "@/components/AdInFeed";
import { AffiliateInFeedCard } from "@/components/AffiliateInFeedCard";
import type { InFeedAnnonce } from "@/lib/infeed-annonce";

/**
 * Den ene in-feed-plads i et shelter-grid: enten AdSense som hidtil, eller
 * affiliate-produktkortet. Se lib/infeed-annonce.ts for forsoegets opbygning.
 *
 * ALLE TRE PLADSER kan blive til produktkort (november 2026; foer kun plads 0).
 * AdSense gav naesten ingenting, saa i de tre affiliate-arme viser hver plads
 * sin egen vare, og AdSense-armen viser AdSense paa alle tre som kontrol.
 *
 * En plads viser AdSense naar `annonce` er null (en flade der ikke er med i
 * forsoeget), naar armen er `adsense`, og naar der ikke er en vare til netop
 * den plads, fx i tilbudsarmen naar for faa af sidens guider har en vare med
 * reel foerpris.
 */
export function InFeedSlot({
  nr,
  annonce,
  className,
}: {
  /** Loebenummer fra inFeedAdIndex: 0, 1 eller 2. */
  nr: number;
  annonce?: InFeedAnnonce | null;
  className?: string;
}) {
  const vare = annonce?.varer?.[nr];
  if (vare && annonce && annonce.arm !== "adsense") {
    return (
      <AffiliateInFeedCard vare={vare} arm={annonce.arm} plads={nr} className={className} />
    );
  }
  return <AdInFeed className={className} />;
}
