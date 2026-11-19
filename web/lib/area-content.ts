import type { AreaFaqEmne, FaqItem } from "@/lib/faq";
import type { RedaktionelSektion } from "@/components/RedaktionelleSektioner";

/**
 * Redaktionelt indhold til enkelte omraadesider (/omraade/[slug]), ud over
 * skabelonen alle omraader deler.
 *
 * Findes fordi Hærvejen havde tre sider, der konkurrerede om de samme
 * soegninger, hver med sit eget antal: /haervejen (20 pladser, titelmatch),
 * /omraade/haervejen (242, area_slug) og /ruteplanner/haervejen (98 inden for
 * ruten). Over 180 dage til 16/11 2026 fik omraadesiden 194 klik, /haervejen
 * 11 og ruteplanneren 6, saa omraadesiden blev samlesiden. /haervejen
 * redirecter hertil (next.config.js), og dens FAQ, pakkeliste og relaterede
 * links er flyttet med. Ruteplanneren er bevaret som rutekort.
 */
export interface AreaContent {
  /** Stilles foran de generelle omraade-spoergsmaal. */
  faq: FaqItem[];
  /** Skabelonens spoergsmaal, som `faq` allerede svarer konkret paa. */
  faqErstatter?: AreaFaqEmne[];
  sections?: RedaktionelSektion[];
  related?: { label: string; href: string; note: string }[];
}

export const AREA_CONTENT: Record<string, AreaContent> = {
  haervejen: {
    faq: [
      {
        question: "Hvor mange dage tager det at vandre Hærvejen?",
        answer:
          "Hele strækningen fra Padborg til Viborg er cirka 290 km og tager typisk 12-15 dage til fods. Mange går kortere etaper på 3-5 dage, fx Viborg-Jelling eller Jelling-Padborg.",
      },
      {
        question: "Kan man overnatte gratis langs Hærvejen?",
        answer:
          "Ja. En stor del af pladserne langs ruten er primitive shelters og teltpladser i statsskov, som er gratis at bruge. Andre er herberger og lejrpladser med en mindre betaling.",
      },
      {
        question: "Skal man booke shelters langs Hærvejen?",
        answer:
          "De fleste primitive pladser er først-til-mølle. I højsæsonen (juni-august) kan det være svært at finde plads på de mest populære strækninger, så overvej at booke hvor det er muligt, eller medbring telt som alternativ.",
      },
    ],
    // De to konkrete svar om gratis overnatning og booking ovenfor er bedre
    // end skabelonens generelle.
    faqErstatter: ["gratis", "booking"],
    related: [
      { label: "Rutekort over Hærvejen", href: "/ruteplanner/haervejen", note: "hele ruten med etaper" },
      { label: "Shelters ved Gudenåen", href: "/gudenaaen", note: "en anden klassisk rute" },
      { label: "Shelter til cykeltur", href: "/shelter-til-cykeltur", note: "hvis du cykler Hærvejen" },
      { label: "Teltpladser i Danmark", href: "/teltplads", note: "hvis du har telt med" },
    ],
    // Ingen soeger paa "pakkeliste hærvejen" (GSC 180 dage, 19/11 2026), saa
    // det er ikke en side for sig. Sektionen er her for dem, der allerede
    // planlaegger turen, og sender videre til guiderne.
    sections: [
      {
        heading: "Pakkeliste til Hærvejen",
        paragraphs: [
          "Hærvejen går man typisk i etaper på 15 til 25 km om dagen, og det er fødderne og rygsækkens vægt, der afgør, om turen bliver god. Pak efter, at du skal bære det hele hver dag: én sovepose, ét liggeunderlag og ét kogesæt, og lad det blive hjemme, du kun måske får brug for.",
          "Gå skoene til hjemmefra, før du tager af sted, og pak vabelplaster og et par ekstra vandresokker. Ruten går for en stor del ad grusveje og små landeveje, så mange vælger lette vandresko frem for tunge støvler.",
          "De fleste primitive shelters på ruten er først til mølle. Har du ikke booket, så pak en tarp eller et let telt som plan B, især fra juni til august. Shelteren har bund af træ og er åben til den ene side, så liggeunderlaget skal isolere, og soveposen skal passe til nattens temperatur, ikke dagens.",
          "Tjek på den enkelte plads, om der er drikkevand, og hav plads til mindst 1,5 liter i rygsækken. Et vandfilter gør dig uafhængig af vandhanerne, hvis du fylder op fra sø eller å. Til madlavning er et lille stormkøkken og frysetørret mad det letteste at bære.",
          "Der er sjældent stikkontakter ved de primitive pladser. Tag en pandelampe med og en powerbank til telefonen, som også er dit kort på turen.",
        ],
        links: [
          { label: "Bedste vandresko", href: "/bedste/vandresko" },
          { label: "Bedste vandrestøvler", href: "/bedste/vandrestovler" },
          { label: "Bedste vandresokker", href: "/bedste/vandresokker" },
          { label: "Bedste vandrerygsæk", href: "/bedste/vandrerygsaek" },
          { label: "Bedste letvægtstelt", href: "/bedste/letvaegtstelt" },
          { label: "Bedste tarp", href: "/bedste/tarp" },
          { label: "Bedste vandfilter", href: "/bedste/vandfilter" },
          { label: "Bedste stormkøkken", href: "/bedste/stormkoekken" },
          { label: "Bedste powerbank", href: "/bedste/powerbank" },
          { label: "Den fulde pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
        ],
      },
    ],
  },
};

export function getAreaContent(slug: string): AreaContent | null {
  return AREA_CONTENT[slug] ?? null;
}

/**
 * Ruter i ruteplanneren, der har en samleside for overnatning. Rutesiden er
 * rutekortet; samlesiden er der, hvor "shelter langs <rute>" skal lande.
 * Rutesiden linker derfor dertil og bruger ikke selv soegeordet som
 * overskrift over sin liste.
 */
export const RUTE_SAMLESIDE: Record<string, { href: string; navn: string }> = {
  haervejen: { href: "/omraade/haervejen", navn: "Hærvejen" },
};
