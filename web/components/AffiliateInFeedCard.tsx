"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { ProduktBillede } from "@/components/ProduktBillede";
import { foersteOrd } from "@/lib/produktnavn";
import { retailerNavn } from "@/lib/retailer-navn";
import { useInView } from "@/lib/useInView";
import { trackAffiliateClick, trackInFeedSeen } from "@/lib/tracking";
import type { InFeedArm, InFeedVare } from "@/lib/infeed-annonce";

/**
 * Affiliate-produktkort i shelter-grid'et, som erstatning for AdSense i den
 * foerste in-feed-plads. Se lib/infeed-annonce.ts for forsoegets opbygning.
 *
 * FORMSPROGET er husets produktkort (GearCardClient ProductVariant) sat ind i
 * shelter-kortets skal. Foerste version havde sin egen: tonet accent-baggrund,
 * fast 150 px billede, sans-navn og et tekstlink til sidst. Ved siden af
 * shelter-kortene, som er hvide med skygge, loefter sig ved hover og har et
 * 4:3-foto, laeste den som et deaktiveret panel frem for noget man kan trykke
 * paa. Kortet bruger derfor nu:
 *
 *   skal      hvid, rounded-xl, shadow-sm, loefter sig ved hover
 *             — identisk med ShelterCard, saa det hoerer til i raekken
 *   billede   4:3-plade i bg-background med object-contain og luft omkring
 *             — samme hoejde som naboernes fotos, saa raekken flugter foroven,
 *               og produktfotos paa hvid bund faar en neutral plade at staa paa
 *   navn      font-serif, husets display-skrift, som i guidernes produktkort
 *   maerke    accent-farvet versal-linje, som i guidernes produktkort
 *   knap      fyldt 44 px CTA i bunden, ikke et tekstlink
 *
 * MAERKNINGEN er ikke kosmetik. Markedsfoeringsloven kraever at reklame kan
 * genkendes som reklame, og /saadan-vurderer-vi lover at rangeringer er
 * redaktionelle. Et indskudt produktkort er en annonce og ikke en anbefaling.
 * Etiketten sidder nu som en chip paa billedpladen i stedet for som en hel
 * raekke tekst oeverst: den ses i samme oejekast som kortet, men koster ingen
 * lodret plads. Bundlinjen baerer resten af oplysningen — hvilken butik
 * linket gaar til, og en vej til /annoncer-og-partnere.
 *
 * BUNDLINJEN ligger UDEN FOR <a>'et. Resten af kortet er ét stort link, saa
 * trykmaalet er lige saa stort som nabokortenes, og et klik giver praecis én
 * maaling. Et link i et link er ugyldig HTML, saa oplysningslinjen maatte
 * enten undvaere sit link til annoncepolitikken eller ligge udenfor. Den
 * ligger udenfor.
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
  // discount_pct udregnes af feed-synken og kan mangle, mens foerprisen er der.
  // Det gaelder ingen varer i dag, men `rabatPct ?? 0` ville skrive "–0%" den
  // dag det sker, saa procenten udledes af priserne naar feedet ikke har den.
  // Under 1% vises intet maerke: et nulmaerke er daarligere end ingenting.
  const rabatPct = nedsat
    ? Math.round(vare.rabatPct ?? (1 - vare.pris / vare.foerPris!) * 100)
    : 0;
  const visRabat = arm === "tilbud" && rabatPct >= 1;
  const visBegrundelse = arm === "kontekst" && vare.begrundelse.trim().length > 0;
  // Maerkelinjen vises kun naar den tilfoejer noget.
  //
  // 307 af de 362 varer i guiderne har hele maerket som optakt til navnet
  // ("Light My Fire" over "Light My Fire FireSteel BIO"). De sidste otte med
  // et maerke er de samme to ord med en stavevariant imellem: "Coghlan's" mod
  // "Coghlans", "Columbia Sportswear" mod "Columbia ...", "Membrane
  // Solutions" mod "Membrane Solution ...". En ren prefix-test ville lade
  // netop dem staa med en versal-linje der gentager navnets foerste ord, saa
  // sammenligningen gaar paa foerste ord uden tegnsaetning.
  //
  // Det betyder at linjen aldrig vises for det nuvaerende katalog. Den bliver
  // staaende alligevel: et feed kan sagtens levere "Thrive Flip Straw 32oz"
  // med maerket Camelbak, og saa er maerket den oplysning man mangler.
  const visMaerke = vare.maerke != null && foersteOrd(vare.maerke) !== foersteOrd(vare.navn);

  return (
    <aside
      ref={ref}
      aria-label="Annonce"
      className={`group flex flex-col overflow-hidden rounded-xl border border-accent/30 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 ${className ?? ""}`}
    >
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
            position: `infeed_${arm}`,
            priceDkk: vare.pris,
          })
        }
        className="flex flex-1 flex-col focus:outline-none"
      >
        <div className="relative h-44 shrink-0 bg-background sm:aspect-[4/3] sm:h-auto">
          <ProduktBillede
            src={vare.billede}
            alt={vare.navn}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-4"
          />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/55 ring-1 ring-primary/10">
            Annonce
          </span>
          {visRabat && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-accent-dark px-2.5 py-1 text-xs font-bold text-white">
              &ndash;{rabatPct}%
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          {visBegrundelse && (
            <p className="mb-1.5 border-l-2 border-accent pl-2.5 text-[13px] font-semibold leading-snug text-primary">
              {vare.begrundelse}
            </p>
          )}

          {visMaerke && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              {vare.maerke}
            </p>
          )}

          <h3 className="line-clamp-2 font-serif text-base font-bold leading-tight text-primary">
            {vare.navn}
          </h3>

          {/* mt-auto: priser og knapper flugter paa tvaers af raekken, uanset
              hvor mange linjer navnet fylder. */}
          <div className="mt-auto pt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary">{formatKr(vare.pris)}</span>
              {visRabat && (
                <span className="text-sm text-primary/40 line-through">
                  {formatKr(vare.foerPris!)}
                </span>
              )}
            </div>
            {/* Hele kortet er linket, saa knappen er ikke selve trykmaalet og
                behoever ikke de 44 px. 40 px er stadig et tydeligt maal for
                den der sigter efter den. */}
            <span className="mt-2 flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors group-hover:bg-accent">
              {visRabat ? "Se tilbud" : "Se pris"}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </a>

      <p className="border-t border-primary/5 px-3.5 py-1.5 text-center text-[11px] leading-snug text-primary/50">
        Hos {retailerNavn(vare.retailer)} ·{" "}
        <a href="/annoncer-og-partnere" className="hover:underline">
          sponsoreret link
        </a>
      </p>
    </aside>
  );
}

/** "1.299 kr." med dansk tusindtalsskilletegn, som resten af sitet. */
function formatKr(n: number): string {
  return `${new Intl.NumberFormat("da-DK").format(Math.round(n))} kr.`;
}
