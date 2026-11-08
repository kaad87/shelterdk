import { AdInFeed } from "@/components/AdInFeed";
import { AffiliateInFeedCard } from "@/components/AffiliateInFeedCard";
import type { InFeedAnnonce } from "@/lib/infeed-annonce";

/**
 * Den ene in-feed-plads i et shelter-grid: enten AdSense som hidtil, eller
 * affiliate-produktkortet. Se lib/infeed-annonce.ts for forsoegets opbygning.
 *
 * KUN PLADS NUMMER 0 kan blive til et produktkort. Plads 1 og 2 bliver ved med
 * at vaere AdSense, saa annoncetaetheden paa siden er praecis som i dag og
 * indtjeningsgulvet bevares mens forsoeget koerer. Det er ogsaa derfor
 * sammenligningen mellem armene er ren: produktkortet staar altid samme sted,
 * og AdSense-armen staar det samme sted paa sin fjerdedel af siderne.
 *
 * `annonce` er null naar kaldestedet ikke har hentet en (en flade der endnu
 * ikke er med i forsoeget). Da viser pladsen AdSense, som foer. Det samme
 * gaelder naar armen er `adsense`, og naar armen er `tilbud` men ingen af
 * sidens matchede guider har en vare med reel foerpris.
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
  if (nr === 0 && annonce?.vare && annonce.arm !== "adsense") {
    return (
      <AffiliateInFeedCard vare={annonce.vare} arm={annonce.arm} className={className} />
    );
  }
  return <AdInFeed className={className} />;
}
