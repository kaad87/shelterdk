import type { Metadata } from "next";
import Link from "next/link";
import { FEEDS } from "@/lib/affiliate-feeds";

/**
 * Én linje pr. grej-forhandler. Typen er noeglet paa FEEDS, saa et nyt feed
 * uden en beskrivelse her er en typefejl frem for en forhandler, der stille
 * mangler paa siden. Det var praecis det, der var sket: siden naevnte tre af
 * de syv aktive, og en ekstern audit fangede det 27. oktober 2026. Siden
 * hedder "Vores partnere" og skal efter markedsfoeringsloven vaere komplet.
 */
const FORHANDLER_OM: Record<(typeof FEEDS)[number]["retailer"], string> = {
  backpackerlife: "Dansk online outdoor- og prepping-butik",
  outdoortid: "Dansk specialist i outdoor- og camping-grej",
  outmore: "Dansk online outdoor-forhandler med bredt sortiment",
  prooutdoor: "Dansk forhandler af outdoor-tøj og fodtøj",
  outdoornu: "Dansk outdoor-butik med tøj og lag-på-lag",
  zeejuu: "Dansk butik med kikkerter og optik",
  outdooricentrum: "Dansk forhandler af økser, save og håndværktøj",
};

/** Partnere uden for grej-feedene: shelter-byggesaet og overnatning. */
const ANDRE_PARTNERE = [
  { navn: "Sølund Huse", om: "Danske shelter-samlesæt, bålhytter og covers", netvaerk: "Partner-ads" },
  { navn: "Booking.com", om: "Glamping og naturophold i Danmark", netvaerk: "CJ Affiliate" },
] as const;

export const metadata: Metadata = {
  title: "Annoncer og partnere — sådan finansieres ShelterDK",
  description:
    "ShelterDK.dk er gratis at bruge. Læs om vores affiliate-partnere, hvordan vi finansieres, og vores løfte om kurateret grej-anbefaling.",
  alternates: { canonical: "/annoncer-og-partnere" },
};

export default function AnnoncerOgPartnerePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Annoncer og partnere</span>
      </nav>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
        Annoncer, partnere og hvordan ShelterDK finansieres
      </h1>
      <div className="prose prose-primary mt-6 max-w-none">
        <p>
          ShelterDK.dk er gratis at bruge. Vi holder projektet kørende ved at
          samarbejde med udvalgte danske outdoor-forhandlere som
          affiliate-partnere. Når du klikker på et af vores
          produkt-anbefalinger og køber noget, modtager ShelterDK en lille
          kompensation — uden at det koster dig ekstra.
        </p>

        <h2>Vores partnere</h2>
        <p>
          Listen er fuldstændig: den dækker alle forhandlere, vi tjener på. Grej-partnerne
          herunder kommer fra sitets egen feed-konfiguration, så en ny forhandler
          ikke kan komme til uden også at stå her.
        </p>
        <ul>
          {FEEDS.map((f) => (
            <li key={f.retailer}>
              <strong>{f.label}</strong> — {FORHANDLER_OM[f.retailer]} (Partner-ads)
            </li>
          ))}
          {ANDRE_PARTNERE.map((p) => (
            <li key={p.navn}>
              <strong>{p.navn}</strong> — {p.om} ({p.netvaerk})
            </li>
          ))}
        </ul>

        <h2>Vores løfte</h2>
        <ul>
          <li>Vi anbefaler kun grej, vi selv ville bruge.</li>
          <li>
            Priser og lagerstatus opdateres dagligt direkte fra forhandlerne —
            du ser altid den seneste pris.
          </li>
          <li>
            Vi viser altid rabatprocenten klart, så du kan se hvor meget du
            sparer.
          </li>
          <li>
            Vi modtager ikke betaling for at placere specifikke produkter. Alle
            produkter vi fremhæver er valgt ud fra relevans og kvalitet.
          </li>
        </ul>

        <h2>Hvad hvis du ser en forkert pris eller et dårligt match?</h2>
        <p>
          Skriv til os på <Link href="/kontakt">kontaktsiden</Link>, så retter
          vi det hurtigst muligt.
        </p>

        <h2>Det juridiske</h2>
        <p>
          Alle affiliate-links er markeret med &ldquo;Annonce · Sponsoreret link&rdquo; på
          produktkortene og benytter <code>rel=&ldquo;sponsored&rdquo;</code>-attributten i
          linket, i overensstemmelse med markedsføringsloven §6 og Google&apos;s
          retningslinjer.
        </p>
        <p>
          Når du klikker videre til en af vores partnere, kan forhandlerens
          side sætte cookies til sporing af dit køb. Disse cookies er under
          den pågældende forhandlers kontrol og dækkes af deres
          privatlivspolitik.
        </p>
      </div>
    </article>
  );
}
