import Link from "next/link";
import type { ReactNode } from "react";
import { blackFridaySaeson, formatBlackFridayDato, julegaveSaeson } from "@/lib/kampagne";

/**
 * Saesonlinje, der peger paa /black-friday og /julegaver fra grej-klyngen
 * og forsiden.
 *
 * Findes fordi /black-friday kun var linket fra footeren og fra /tilbud. Siden
 * er den samme uge vaerd hvert aar, og Google skal finde den, inden ugen gaar
 * i gang, saa den skal have links fra de sider, der i forvejen handler om at
 * koebe grej: hubben og hver enkelt koebsguide. /julegaver havde samme
 * problem (kun footeren og /tilbud, 19/11 2026).
 *
 * Linjen skriver DATOEN og ikke en nedtaelling. Begge sider har revalidate paa
 * en time, men Netlifys durable cache serverer den gamle render, indtil noget
 * udloeser en ny, og paa en guide med lidt trafik kan det vaere laengere end
 * et doegn. "Om 27 dage" er saa forkert. En dato er rigtig, uanset hvor gammel
 * renderen er, og den er mere brugbar, naar man skal planlaegge et koeb.
 *
 * Raekkefoelgen: Black Friday har forrang i sin saeson. Paa hubben og
 * forsiden faar julegaverne en saetning med ved siden af, i guiderne ikke,
 * dér skal noten handle om én ting. Fra tirsdagen efter Cyber Monday til og
 * med 21. december handler noten kun om julegaver.
 *
 * Renderer intet uden for saesonerne, saa der ikke staar Black Friday eller
 * jul paa en soveposeguide i marts.
 */
export function KampagneNote({ variant }: { variant: "hub" | "guide" }) {
  const idag = new Date();
  const status = blackFridaySaeson(idag);
  const jul = julegaveSaeson(idag);
  if (!status && !jul) return null;

  const julLink = (
    <Link href="/julegaver" className="font-medium text-accent hover:underline">
      julegaver til friluftsfolk
    </Link>
  );

  let indhold: ReactNode;
  if (status) {
    const link = (
      <Link href="/black-friday" className="font-medium text-accent hover:underline">
        Black Friday {status.aar}
      </Link>
    );
    // Selve dagen og weekenden efter: da er datoen uinteressant, og det er
    // tilbuddene, der er nyheden.
    indhold = status.erIGang ? (
      <>
        <strong className="text-primary">Black Friday er i gang.</strong> Vi viser kun grej, hvor
        vi selv har set prisen falde, så du kan se hvad der reelt er sat ned: {link}.
      </>
    ) : variant === "hub" ? (
      <>
        <strong className="text-primary">Black Friday {status.aar}</strong> falder{" "}
        {formatBlackFridayDato(status.dato)}. Butikkens egen før-pris siger ikke, om en vare er sat
        ned, så vi viser kun grej, hvor vi selv har set prisen falde: {link}.
      </>
    ) : (
      <>
        Overvejer du at vente med at købe? {link} falder {formatBlackFridayDato(status.dato)}, og
        siden viser kun varer, hvor vi selv har set prisen falde.
      </>
    );
    if (variant === "hub" && jul) {
      indhold = (
        <>
          {indhold} Skal det være en gave, har vi samlet {julLink}: det bedst scorede grej fra
          guiderne, delt op efter pris.
        </>
      );
    }
  } else {
    indhold =
      variant === "hub" ? (
        <>
          <strong className="text-primary">Skal det være en gave?</strong> Under {julLink} har vi
          samlet det bedst scorede grej fra vores købsguider, delt op efter pris og alt under 1.000
          kr. Intet af det kræver, at du kender en størrelse.
        </>
      ) : (
        <>
          Skal det være en gave? Se {julLink}: det bedst scorede grej fra alle vores købsguider,
          under 1.000 kr. og uden størrelser at gætte på.
        </>
      );
  }

  if (variant === "guide") {
    return (
      <p className="mt-10 border-t border-primary/10 pt-6 text-sm text-primary/70">{indhold}</p>
    );
  }
  return (
    <p className="mb-10 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-primary/80">
      {indhold}
    </p>
  );
}
