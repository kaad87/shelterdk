/**
 * Sektioner til llms.txt / llms-full.txt for det indhold AI-assistenter
 * faktisk henter.
 *
 * Målt i klik-loggen: alle 17 AI-henviste klik (ChatGPT, Copilot, Perplexity)
 * siden juni er gået til /bedste/* — og netop den sektion stod ikke i filen.
 * Det samme gjaldt /fri-teltning, /koeb-shelter, /teltplads, /baalhytte og
 * /tilbud. Linjerne bærer tal (antal, prisspænd, førstevalg), fordi det er
 * dem en assistent kan citere.
 */

export interface GuideLine {
  slug: string;
  title: string;
  /** Produkter der kan købes lige nu — guider uden udelades. */
  buyable: number;
  minPrice: number | null;
  maxPrice: number | null;
  /** Navnet på guidens førstevalg, hvis ét er udpeget. */
  winner: string | null;
}

function kr(n: number): string {
  return new Intl.NumberFormat("da-DK").format(Math.round(n));
}

export function buyingGuideLines(guides: GuideLine[]): string[] {
  return [...guides]
    .filter((g) => g.buyable > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug, "da"))
    .map((g) => {
      const pris =
        g.minPrice != null && g.maxPrice != null
          ? `, ${kr(g.minPrice)}–${kr(g.maxPrice)} kr`
          : "";
      const vinder = g.winner ? `. Førstevalg: ${g.winner}` : "";
      return `- [${g.title}](https://shelterdk.dk/bedste/${g.slug}): ${g.buyable} produkter scoret og rangeret${pris}${vinder}.`;
    });
}

export interface ThemeCounts {
  friTeltning: number;
  teltplads: number;
  baalhytte: number;
}

export function themeLines(c: ThemeCounts): string[] {
  return [
    `- [Fri teltning i Danmark](https://shelterdk.dk/fri-teltning): Kort og liste over ${c.friTeltning} statsskove hvor man må slå telt op uden booking, med 1-2-3-reglen og de øvrige regler.`,
    `- [Teltpladser i Danmark](https://shelterdk.dk/teltplads): ${c.teltplads} primitive telt- og lejrpladser med faciliteter og priser.`,
    `- [Bålhytter i Danmark](https://shelterdk.dk/baalhytte): ${c.baalhytte} bålhytter med overdækket bålsted, plus prisniveau hvis man vil købe en.`,
    `- [Køb shelter](https://shelterdk.dk/koeb-shelter): Hvad et shelter koster (byggesæt, samlesæt, byg selv), hvor man køber det, og reglerne for shelter i haven.`,
    `- [Byggetilladelse til shelter](https://shelterdk.dk/byggetilladelse-til-shelter): Et shelter kræver normalt ikke byggetilladelse — op til 50 m² sekundær bebyggelse på en grund med enfamiliehus, mindst 2,5 m til skel, på terræn og ikke til beboelse.`,
    `- [Tilbud på outdoor-grej](https://shelterdk.dk/tilbud): Aktuelle prisfald på grej, opdateret dagligt fra forhandlernes feeds.`,
  ];
}
