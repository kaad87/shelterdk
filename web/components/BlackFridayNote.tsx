import Link from "next/link";
import { blackFridaySaeson, formatBlackFridayDato } from "@/lib/kampagne";

/**
 * Saesonlinje, der peger paa /black-friday fra grej-klyngen.
 *
 * Findes fordi /black-friday kun var linket fra footeren og fra /tilbud. Siden
 * er den samme uge vaerd hvert aar, og Google skal finde den, inden ugen gaar
 * i gang, saa den skal have links fra de sider, der i forvejen handler om at
 * koebe grej: hubben og hver enkelt koebsguide.
 *
 * Linjen skriver DATOEN og ikke en nedtaelling. Begge sider har revalidate paa
 * en time, men Netlifys durable cache serverer den gamle render, indtil noget
 * udloeser en ny, og paa en guide med lidt trafik kan det vaere laengere end
 * et doegn. "Om 27 dage" er saa forkert. En dato er rigtig, uanset hvor gammel
 * renderen er, og den er mere brugbar, naar man skal planlaegge et koeb.
 *
 * Renderer intet uden for saesonen, saa der ikke staar Black Friday paa en
 * soveposeguide i marts.
 */
export function BlackFridayNote({ variant }: { variant: "hub" | "guide" }) {
  const status = blackFridaySaeson(new Date());
  if (!status) return null;

  const link = (
    <Link href="/black-friday" className="font-medium text-accent hover:underline">
      Black Friday {status.aar}
    </Link>
  );

  // Selve dagen og weekenden efter: da er datoen uinteressant, og det er
  // tilbuddene, der er nyheden.
  const indhold = status.erIGang ? (
    <>
      <strong className="text-primary">Black Friday er i gang.</strong> Vi viser kun grej, hvor
      før-prisen faktisk er højere end prisen i dag, så du kan se hvad der reelt er sat ned:{" "}
      {link}.
    </>
  ) : variant === "hub" ? (
    <>
      <strong className="text-primary">Black Friday {status.aar}</strong> falder{" "}
      {formatBlackFridayDato(status.dato)}. Næsten alle produktfeeds sender den samme pris i både
      før-feltet og nu-feltet, så vi viser kun grej, hvor før-prisen faktisk er højere end prisen i
      dag: {link}.
    </>
  ) : (
    <>
      Overvejer du at vente med at købe? {link} falder {formatBlackFridayDato(status.dato)}, og
      siden viser kun varer, hvor før-prisen faktisk er højere end prisen i dag.
    </>
  );

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
