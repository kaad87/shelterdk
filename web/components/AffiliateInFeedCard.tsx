"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { ProduktBillede } from "@/components/ProduktBillede";
import { useInView } from "@/lib/useInView";
import { trackAffiliateClick, trackInFeedSeen } from "@/lib/tracking";
import type { InFeedArm, InFeedVare } from "@/lib/infeed-annonce";

/**
 * Affiliate-produktkort i shelter-grid'et, som erstatning for AdSense i den
 * foerste in-feed-plads. Se lib/infeed-annonce.ts for forsoegets opbygning.
 *
 * MAERKNINGEN er ikke kosmetik. Markedsfoeringsloven kraever at reklame kan
 * genkendes som reklame, og /saadan-vurderer-vi lover at rangeringer er
 * redaktionelle. Et indskudt produktkort er en annonce og ikke en anbefaling,
 * saa "Annonce"-etiketten staar oeverst med samme ordlyd og placering som i
 * AdInFeed, og kortet beholder den lette afvigende baggrund, saa det aldrig
 * kan forveksles med et shelter.
 *
 * Linket er rel="sponsored nofollow" og target="_blank": sponsored er Googles
 * egen anvisning for betalte links, og uden den risikerer vi at sitets egne
 * sider bliver vurderet paa de links de sender videre.
 *
 * BILLEDET gaar gennem ProduktBillede og ikke <Image> direkte. Den baerer
 * husets reserve for de feed-URL'er butikkerne har slettet (11 af 362 varer
 * den 8. november 2026), saa et doedt billede giver et neutralt felt i samme
 * stoerrelse i stedet for en brudt kasse midt i shelter-grid'et.
 */
export function AffiliateInFeedCard({
  vare,
  arm,
  className,
}: {
  vare: InFeedVare;
  arm: Exclude<InFeedArm, "adsense">;
  className?: string;
}) {
  const { ref, isInView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    if (!isInView) return;
    trackInFeedSeen({
      arm,
      guideSlug: vare.guideSlug,
      produktId: vare.produktId,
      priceDkk: vare.pris,
    });
  }, [isInView, arm, vare.guideSlug, vare.produktId, vare.pris]);

  // Samme betingelse inline som i GearCardClient, og med vilje IKKE et kald til
  // harRabat i lib/infeed-annonce: den fil importerer Supabase-klienten, og et
  // vaerdi-import herfra ville traekke supabase-js med ind i klient-bundlen paa
  // hver side der viser kortet. Typerne ovenfor er `import type` og forsvinder.
  const nedsat = vare.foerPris != null && vare.foerPris > vare.pris;
  const visRabat = arm === "tilbud" && nedsat;
  const visBegrundelse = arm === "kontekst" && vare.begrundelse.trim().length > 0;

  return (
    <aside
      ref={ref}
      aria-label="Annonce"
      className={`flex flex-col overflow-hidden rounded-xl border border-accent/40 bg-accent/[0.04] ${className ?? ""}`}
    >
      <p className="px-3 pt-2.5 text-[11px] uppercase tracking-wide text-primary/40">
        Annonce
      </p>

      <a
        href={vare.url}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        onClick={() =>
          trackAffiliateClick({
            url: vare.url,
            productName: vare.navn,
            retailer: vare.retailer,
            brand: vare.maerke ?? undefined,
            category: vare.kategori ?? undefined,
            position: `infeed_${arm}` as "infeed_ren" | "infeed_tilbud" | "infeed_kontekst",
            priceDkk: vare.pris,
          })
        }
        className="group flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="relative mx-3 mt-1 h-[150px]">
          <ProduktBillede
            src={vare.billede}
            alt={vare.navn}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
            className="object-contain"
          />
        </div>

        <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-2">
          {visRabat && (
            <span className="mb-1.5 self-start rounded bg-accent-dark px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
              SPAR {Math.round(vare.rabatPct ?? 0)}%
            </span>
          )}

          {visBegrundelse && (
            <p className="mb-1.5 border-l-2 border-accent pl-2 text-xs font-semibold leading-snug text-primary">
              {vare.begrundelse}
            </p>
          )}

          {vare.maerke && (
            <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">{vare.maerke}</p>
          )}

          <p className="mb-2 line-clamp-2 text-[13px] font-semibold leading-snug text-primary">
            {vare.navn}
          </p>

          <div className="mt-auto flex items-baseline justify-between gap-2">
            <span className="text-[17px] font-bold text-primary">
              {formatKr(vare.pris)}
              {visRabat && (
                <span className="ml-1.5 text-xs font-normal text-primary/40 line-through">
                  {formatKr(vare.foerPris!)}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent-dark group-hover:underline">
              Se pris
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
        </div>
      </a>
    </aside>
  );
}

/** "1.299 kr." med dansk tusindtalsskilletegn, som resten af sitet. */
function formatKr(n: number): string {
  return `${new Intl.NumberFormat("da-DK").format(Math.round(n))} kr.`;
}
