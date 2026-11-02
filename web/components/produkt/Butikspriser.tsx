import { retailerLabel } from "@/lib/affiliate-retailer";
import { billigstIalt, prisAfhaengerAfStoerrelse, type Tilbud } from "@/lib/produkt-match";

function kr(n: number): string {
  return `${n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
}

/**
 * Priser hos de butikker der foerer samme model.
 *
 * Modulet degraderer med vilje i stedet for at forsvinde. Maalt 1. november
 * 2026 findes 355 af de 362 guide-varer kun ét sted, saa "én butik" er den
 * normale tilstand og ikke en fejl. En tabel med én raekke og ordet
 * "sammenlign" over ville love noget der ikke er der, saa i stedet staar der
 * hvad vi faktisk ved.
 */
export function Butikspriser({
  tilbud,
  egetId,
  egetNavn,
  affiliateUrl,
  fragt,
  kategori,
}: {
  tilbud: Tilbud[];
  egetId: string;
  egetNavn: string;
  affiliateUrl: string;
  fragt: number | null;
  /** Varens kategori. Afgoer om prisen kan gaelde én stoerrelse. */
  kategori: string | null;
}) {
  if (tilbud.length < 2) {
    const kun = tilbud[0];
    return (
      <div className="rounded-xl border border-primary/10 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-semibold text-primary">{retailerLabel(kun?.retailer ?? "")}</span>
          <span className="text-lg font-bold text-primary">{kr(kun?.price ?? 0)}</span>
        </div>
        <p className="mt-0.5 text-xs text-primary/50">
          {fragt != null
            ? `+ ${kr(fragt)} fragt = ${kr((kun?.price ?? 0) + fragt)}`
            : "fragt oplyses i kurven"}
        </p>
        <a
          href={affiliateUrl}
          target="_blank"
          rel="sponsored nofollow noopener"
          className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-accent-dark px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary"
        >
          Se den hos {retailerLabel(kun?.retailer ?? "")}
        </a>
        <p className="mt-3 border-t border-primary/10 pt-3 text-xs leading-relaxed text-primary/60">
          Vi følger seks butikker, og lige nu er {egetNavn} kun hos én af dem. Vi skriver det her i
          stedet for at vise en sammenligning med én pris i.
        </p>
      </div>
    );
  }

  const ialtBilligst = billigstIalt(tilbud);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white">
        {tilbud.map((t, i) => {
          const billigst = i === 0;
          const detteErSiden = t.id === egetId;
          return (
            <div
              key={t.retailer}
              className={`flex items-center gap-3 p-4 ${i > 0 ? "border-t border-primary/10" : ""} ${
                billigst ? "border-l-[3px] border-l-pine" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{retailerLabel(t.retailer)}</span>
                  {billigst && (
                    <span className="rounded bg-pine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Billigst
                    </span>
                  )}
                </div>
                {/* Butikkens eget navn, naar det ikke er varen siden handler om:
                    farve er ikke en del af matchningen, saa den billigste hos
                    én butik kan vaere en anden farve end den hos en anden. */}
                {!detteErSiden && (
                  <p className="mt-0.5 truncate text-xs text-primary/50">{t.navn}</p>
                )}
                {t.varianter > 1 && (
                  <p className="mt-0.5 text-xs text-primary/50">
                    Billigste af {t.varianter} varianter
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-primary">{kr(t.price)}</p>
                {/* Fragten staar ved prisen, fordi den kan vende
                    raekkefoelgen: 12,00 + 49 er dyrere end 12,95 + 39. */}
                <p className="text-xs text-primary/50">
                  {t.ialt != null
                    ? `+ ${kr(t.fragt ?? 0)} fragt = ${kr(t.ialt)}`
                    : "fragt oplyses i kurven"}
                </p>
                <a
                  href={detteErSiden ? affiliateUrl : t.affiliate_url}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="text-xs font-bold text-accent-dark hover:text-primary"
                >
                  Se pris ›
                </a>
              </div>
            </div>
          );
        })}
      </div>
      {ialtBilligst && (
        <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium leading-relaxed text-primary">
          Billigst i alt er {retailerLabel(ialtBilligst.retailer)} til {kr(ialtBilligst.ialt!)} med
          fragt, selv om {retailerLabel(tilbud[0].retailer)} har den laveste varepris.
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-primary/60">
        Butikkerne har ikke nødvendigvis samme størrelse eller farve på lager. Vi matcher på mærke og
        model, ikke på stregkode, så tjek varen hos butikken.
        {prisAfhaengerAfStoerrelse(kategori) &&
          " Prisen her gælder den størrelse butikken har sendt os, og butikken fører ikke nødvendigvis alle størrelser til den pris."}
      </p>
    </div>
  );
}
