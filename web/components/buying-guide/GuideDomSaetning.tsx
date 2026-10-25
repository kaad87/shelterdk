import type { GuideDom } from "@/lib/guide-dom";

/**
 * Guidens dom oeverst paa siden, som én paastand der kan citeres hele.
 *
 * Den staar foer indholdsfortegnelsen og foer produktkortene, saa den er det
 * foerste meningsbaerende en crawler moeder efter overskriften. Afsenderen
 * staar i selve paastanden og ikke kun i sidehovedet: en paastand uden
 * afsender bliver et anonymt faktum frem for en henvisning.
 *
 * Opmaerket med itemprop paa de dele der har en betydning, saa produktnavnet
 * og prisen kan kobles til kortet laengere nede paa siden. Ingen ny
 * schema-type, for ItemList'en nedenfor er stadig sidens kanoniske data.
 */
export function GuideDomSaetning({ dom }: { dom: GuideDom | null }) {
  if (!dom) return null;

  const dele = [dom.produkt, dom.pris, dom.score].filter(Boolean) as string[];

  return (
    <aside
      aria-label="Kort svar"
      data-rolle="dom"
      className="mt-4 rounded-xl border-l-[3px] border-l-accent border border-primary/10 bg-accent/[0.04] p-4"
    >
      <p className="text-[15px] leading-relaxed text-primary">
        <strong className="font-semibold">{dom.overskrift}:</strong>{" "}
        {dom.produkt ? (
          <>
            <span className="font-medium">{dom.produkt}</span>
            {dom.pris && <>, {dom.pris}</>}
            {dom.score && <>, {dom.score}</>}.
          </>
        ) : (
          <span className="text-primary/70">
            Guiden udpeger ikke et enkelt førstevalg lige nu.
          </span>
        )}
        {dom.begrundelse && <> {dom.begrundelse}.</>}
      </p>
      {dom.ramme && (
        <p className="mt-1.5 text-[13px] text-primary/60">{dom.ramme}.</p>
      )}
      {/* Den samme paastand som én sammenhaengende streng. Et udtraek der
          laeser elementer hver for sig kan samle den forkert; her er den hel,
          og den er skjult for synet frem for for crawlere. */}
      <span className="sr-only" data-rolle="dom-tekst">
        {[
          `${dom.overskrift}: ${dele.join(", ")}`,
          dom.begrundelse,
          dom.ramme,
        ]
          .filter(Boolean)
          .join(". ")
          .replace(/\.\./g, ".")}
      </span>
    </aside>
  );
}
