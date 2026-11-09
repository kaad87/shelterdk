import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduktBySlug, getProduktSlugs } from "@/lib/produktside";
import { produktSlug } from "@/lib/produkt-slug";
import { maerketStaarINavnet, rentNavn } from "@/lib/produktnavn";
import { formatScore } from "@/lib/buying-guides-score";
import { samlBeskrivelse } from "@/lib/produkt-meta";
import { retailerLabel } from "@/lib/affiliate-retailer";
import { billigstIalt } from "@/lib/produkt-match";
import { buildProductSchema } from "@/lib/buying-guides-schema";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { StarRating } from "@/components/buying-guide/StarRating";
import { ProduktBillede } from "@/components/ProduktBillede";
import { Butikspriser } from "@/components/produkt/Butikspriser";
import { Prishistorik } from "@/components/produkt/Prishistorik";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getProduktSlugs()).map((slug) => ({ slug }));
}

/**
 * Om produktsiderne maa indekseres.
 *
 * Stod paa false, mens de 362 sider blev set igennem: et site der lever af
 * soegetrafik kan ikke trille saa stort et indgreb tilbage, for en side
 * Google har indekseret og derefter mistet, taeller som tabt kvalitet.
 * Aabnet 2. november 2026 efter QA af alle 362 sider (unikke titler,
 * beskrivelser og h1, gyldigt Product-skema, skemapris lig den synlige,
 * 9% tekstoverlap med guiderne og ét indgaaende link pr. side).
 *
 * Vendes den tilbage til false, skal /grej ogsaa ud af app/sitemap.ts igen:
 * et sitemap der indsender noindex-sider er et modsat signal.
 */
const INDEKSER = true;

function kr(n: number): string {
  return `${n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getProduktBySlug(params.slug);
  if (!data) return {};
  const billigste = data.tilbud[0];
  // Prioriteret raekkefoelge: de foerste dele er dem der skal med, resten
  // fylder snippet-pladsen ud naar der er plads. Se lib/produkt-meta.ts.
  const beskrivelse = samlBeskrivelse([
    data.entry.best_for ? `${data.navn}: ${data.entry.best_for.toLowerCase()}.` : `${data.navn}.`,
    data.entry.score != null ? `Vi giver den ${formatScore(data.entry.score)} af 10.` : null,
    // kr() slutter selv paa "kr.", saa der maa ikke saettes punktum efter.
    billigste ? `Pris fra ${kr(billigste.price)}` : null,
    data.tilbud.length > 1 ? `Sammenlignet hos ${data.tilbud.length} butikker.` : null,
    data.entry.award_label ? `${data.entry.award_label}.` : null,
    // Kun naar varen faktisk er blandt de koebbare. getProduktBySlug saetter
    // plads til antalIGuiden + 1 for en udsolgt vare, og "nr. 10 af 9" er
    // noget vroevl. Plads 1 staar der heller ikke, for den er enten daekket
    // af award_label eller ikke vaerd at bruge pladsen paa.
    data.plads > 1 && data.plads <= data.antalIGuiden
      ? `Nr. ${data.plads} af ${data.antalIGuiden} i vores test.`
      : null,
    data.entry.pros[0] ? `Fordel: ${data.entry.pros[0].toLowerCase()}.` : null,
    // Fri fragt er et koebsargument i sig selv, og det staar sjaeldent i
    // konkurrenternes snippets.
    billigste?.fragt === 0 ? "Fri fragt." : null,
  ]);
  return {
    // Uden sitenavnet. Produktnavnene er lange (laengste maaler 80 tegn), og
    // "| ShelterDK" kostede 12 af de ~60 tegn Google viser: 24 af 40 maalte
    // titler blev klippet, mod 7 uden. Google skriver selv sitenavnet paa.
    title: { absolute: `${data.navn} – pris og vurdering` },
    description: beskrivelse,
    alternates: { canonical: `https://shelterdk.dk/grej/${data.slug}` },
    robots: INDEKSER ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${data.navn} – pris og vurdering`,
      description: beskrivelse,
      url: `/grej/${data.slug}`,
      images: [data.entry.product.image_url],
    },
  };
}

export default async function ProduktPage({ params }: { params: { slug: string } }) {
  const data = await getProduktBySlug(params.slug);
  if (!data) notFound();

  const { navn, maerke, entry, guide, plads, antalIGuiden, foerstevalg, billigere, tilbud, historik, ogsaaI } =
    data;
  const p = entry.product;
  const laveste = tilbud[0];
  const heroFragt = laveste ? laveste.fragt : p.shipping_cost;
  const ialtBilligst = billigstIalt(tilbud);
  // Samme regel som skemaets enkeltTilbud: er den viste raekke en ANDEN end
  // guidens egen, er den kommet gennem samlTilbuds in_stock-filter og kan
  // koebes. Ellers ville siden skrive "Udsolgt lige nu" over en pris paa en
  // variant der er paa lager, mens skemaet sagde InStock.
  const udsolgt =
    laveste && laveste.id !== p.id ? false : !p.in_stock || p.is_blocked;

  const skema = {
    "@context": "https://schema.org",
    ...buildProductSchema(p, {
      score: entry.score,
      pros: entry.pros,
      cons: entry.cons,
      reviewBody: entry.editorial_note || null,
      // Skemaets pris skal vaere den siden viser. Uden det stod der 959,95 i
      // skemaet, mens overskriften sagde 850,00 fra en anden butik.
      tilbud,
    }),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(skema) }} />
      <BreadcrumbSchema
        items={[
          { label: "Forside", href: "/" },
          { label: "Grej", href: "/bedste" },
          { label: guide.title, href: `/bedste/${guide.slug}` },
          { label: navn },
        ]}
      />

      <nav aria-label="Brødkrumme" className="text-xs text-primary/60">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="px-1.5" aria-hidden="true">
          /
        </span>
        <Link href="/bedste" className="hover:text-accent">
          Grej
        </Link>
        <span className="px-1.5" aria-hidden="true">
          /
        </span>
        <Link href={`/bedste/${guide.slug}`} className="hover:text-accent">
          {guide.title}
        </Link>
        <span className="px-1.5" aria-hidden="true">
          /
        </span>
        <span className="text-primary">{navn}</span>
      </nav>

      {/* HOVEDET: navn, dom og pris staar over faldet, saa soegningen er besvaret med det samme.
          Paa telefon kommer navnet FOER billedet, og billedet er lavt. Med et
          kvadratisk billede i fuld bredde fyldte det 375 px og skubbede baade
          overskrift og pris under folden paa en iPhone. Paa desktop staar de tre
          ved siden af hinanden, og saa er billedet foerst igen. */}
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)] md:items-start">
        <div className="relative order-2 h-44 overflow-hidden rounded-xl border border-primary/10 bg-white md:order-1 md:h-auto md:aspect-square">
          <ProduktBillede
            src={p.image_url}
            alt={navn}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 320px"
            priority
          />
        </div>

        <div className="order-1 min-w-0 md:order-2">
          {/* Optakten over overskriften vises kun naar maerket ikke allerede
              staar i navnet. Fakta-tabellen laengere nede beholder sin
              "Mærke"-raekke: dér er det et datafelt med egen etiket, ikke en
              gentagelse af linjen under. */}
          {maerke && !maerketStaarINavnet(maerke, navn) && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-dark">{maerke}</p>
          )}
          <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-primary md:text-4xl">
            {navn}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary/70">
            Vurderet som del af{" "}
            <Link href={`/bedste/${guide.slug}`} className="underline hover:text-accent">
              {guide.title}
            </Link>
            .
          </p>

          {entry.score != null && (
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-primary/10 bg-white p-4">
              <div className="shrink-0 border-r border-primary/10 pr-4 text-center">
                <div className="font-serif text-3xl font-semibold leading-none text-pine">
                  {formatScore(entry.score)}
                </div>
                <div className="mt-1 text-[11px] text-primary/50">af 10</div>
              </div>
              <div className="min-w-0">
                <StarRating score={entry.score} size={13} />
                {entry.award_label && (
                  <p className="mt-1 text-sm font-bold text-pine">{entry.award_label}</p>
                )}
                <p className="mt-0.5 text-xs leading-relaxed text-primary/60">
                  Nr. {plads} af {antalIGuiden} i guiden.
                  {foerstevalg && (
                    <>
                      {" "}
                      Førstevalget er{" "}
                      <Link
                        href={`/grej/${produktSlug(rentNavn(foerstevalg.product))}`}
                        className="underline hover:text-accent"
                      >
                        {rentNavn(foerstevalg.product)}
                      </Link>
                      .
                    </>
                  )}
                </p>
                {/* Scoren er redaktionel, ikke en labtest. Det skal staa ved tallet,
                    ikke i en fodnote, ellers lover den mere end vi kan holde. */}
                <p className="mt-2 text-[11px] leading-relaxed text-primary/50">
                  Vores egen vurdering, ikke en labtest.{" "}
                  <Link href="/saadan-vurderer-vi" className="underline hover:text-accent">
                    Sådan vurderer vi
                  </Link>
                </p>
              </div>
            </div>
          )}

          {entry.best_for && (
            <p className="mt-5 rounded-r-lg border-l-[3px] border-accent bg-white px-4 py-3 text-base font-medium leading-relaxed text-primary">
              {entry.best_for.charAt(0).toUpperCase() + entry.best_for.slice(1)}.
            </p>
          )}
        </div>

        <div className="order-3 min-w-0">
          <div className="rounded-xl border border-primary/10 bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary/50">
              {tilbud.length > 1 ? "Laveste pris nu" : `Pris hos ${retailerLabel(p.retailer)}`}
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold leading-none text-primary">
              {kr(laveste?.price ?? p.price)}
            </p>
            {/* Foerprisen hoerer til DENNE butiks vare. Staar overskriften med
                en anden butiks lavere pris, ville "850 kr., foer 1.199,95" vaere
                en rabat ingen butik har givet. */}
            {laveste?.id === p.id && p.price_original != null && p.price_original > p.price && (
              <p className="mt-1 text-sm text-primary/50">
                <s>{kr(p.price_original)}</s> før
              </p>
            )}
            {/* Fragten skal hoere til DEN pris der staar ovenfor. Prisen er
                det billigste tilbud, som kan vaere en anden butik end sidens
                egen vare, og saa ville p.shipping_cost blande to butikker
                sammen paa samme maade som foerprisen gjorde. */}
            <p className="mt-2 text-xs text-primary/60">
              {tilbud.length > 1 ? `Hos ${tilbud.length} butikker` : retailerLabel(p.retailer)}
              {heroFragt === 0 ? " · fragt 0 kr." : heroFragt != null ? ` · fragt ${kr(heroFragt)}` : " · fragt oplyses i kurven"}
              {udsolgt ? " · udsolgt" : " · på lager"}
            </p>
            {/* Overskriften er den laveste VAREpris, fordi den skal vaere det
                samme tal som skemaets lowPrice. Er en anden butik billigere
                med fragt, skal det staa her ved knappen og ikke kun nede i
                tabellen: det er her laeseren vaelger. */}
            {ialtBilligst && (
              <p className="mt-2 rounded-lg bg-accent/10 px-2.5 py-2 text-xs font-medium leading-relaxed text-primary">
                {retailerLabel(ialtBilligst.retailer)} er billigst i alt:{" "}
                {kr(ialtBilligst.ialt!)} med fragt.
              </p>
            )}
            {udsolgt ? (
              <p className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-primary/5 px-4 text-center text-sm font-medium text-primary/60">
                Udsolgt lige nu
              </p>
            ) : (
              <a
                href={laveste?.affiliate_url ?? p.affiliate_url}
                target="_blank"
                rel="sponsored nofollow noopener"
                className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-accent-dark px-4 py-3 text-center text-[15px] font-bold text-white hover:bg-primary"
              >
                Se den hos {retailerLabel(laveste?.retailer ?? p.retailer)}
              </a>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-primary/60">
              Annoncelink. Vi får en kommission, hvis du køber. Prisen er den samme for dig.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl font-semibold text-primary">Priser hos butikkerne</h2>
          <p className="mb-3 mt-1 text-sm text-primary/60">
            Hentet fra butikkernes feeds i nat.
          </p>
          <Butikspriser
            tilbud={tilbud}
            egetId={p.id}
            egetNavn={navn}
            affiliateUrl={p.affiliate_url}
            fragt={p.shipping_cost}
            kategori={p.category_mapped}
          />

          <h2 className="mt-10 font-serif text-2xl font-semibold text-primary">Prisudvikling</h2>
          <div className="mt-3 rounded-xl border border-primary/10 bg-white p-5">
            <Prishistorik punkter={historik} />
          </div>

          {(entry.pros.length > 0 || entry.cons.length > 0) && (
            <>
              <h2 className="mt-10 font-serif text-2xl font-semibold text-primary">
                Den er til dig, hvis
              </h2>
              <div className="mt-4 grid gap-7 sm:grid-cols-2">
                {entry.pros.length > 0 && (
                  <ul className="space-y-2.5">
                    {entry.pros.map((t) => (
                      <li key={t} className="flex gap-2.5 text-[15px] leading-snug text-primary">
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-0.5 shrink-0 text-pine"
                          aria-hidden="true"
                        >
                          <path d="M3 8.5 6.2 12 13 4.5" />
                        </svg>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {entry.cons.length > 0 && (
                  <div>
                    <h3 className="mb-2.5 text-sm font-bold text-primary">Det skal du vide først</h3>
                    <ul className="space-y-2.5">
                      {entry.cons.map((t) => (
                        <li key={t} className="flex gap-2.5 text-[15px] leading-snug text-primary/80">
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            className="mt-0.5 shrink-0 text-accent-dark"
                            aria-hidden="true"
                          >
                            <path d="M3.5 8h9" />
                          </svg>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {entry.editorial_note && (
            <>
              <h2 className="mt-10 font-serif text-2xl font-semibold text-primary">Vores vurdering</h2>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-primary">
                {entry.editorial_note}
              </p>
            </>
          )}
        </div>

        <aside className="min-w-0">
          <h2 className="font-serif text-xl font-semibold text-primary">Fakta</h2>
          <dl className="mt-3 grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] overflow-hidden rounded-xl border border-primary/10 bg-white text-sm">
            {maerke && (
              <>
                <dt className="px-4 py-2.5 text-primary/60">Mærke</dt>
                <dd className="px-4 py-2.5 font-medium text-primary">{maerke}</dd>
              </>
            )}
            {p.category_mapped && (
              <>
                <dt className="border-t border-primary/[0.08] px-4 py-2.5 text-primary/60">Type</dt>
                <dd className="border-t border-primary/[0.08] px-4 py-2.5 font-medium text-primary">
                  {p.category_mapped}
                </dd>
              </>
            )}
            {Object.entries((p.specs ?? {}) as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== "")
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="border-t border-primary/[0.08] px-4 py-2.5 text-primary/60">{k}</dt>
                  <dd className="border-t border-primary/[0.08] px-4 py-2.5 font-medium text-primary">
                    {String(v)}
                  </dd>
                </div>
              ))}
            <dt className="border-t border-primary/[0.08] px-4 py-2.5 text-primary/60">Set hos</dt>
            <dd className="border-t border-primary/[0.08] px-4 py-2.5 font-medium text-primary">
              {tilbud.map((t) => retailerLabel(t.retailer)).join(", ")}
            </dd>
          </dl>

          {(foerstevalg || billigere) && (
            <>
              <h2 className="mt-9 font-serif text-xl font-semibold text-primary">
                {foerstevalg ? "Vi valgte en anden som nr. 1" : "Billigere i samme guide"}
              </h2>
              <div className="mt-3 space-y-3">
                {[foerstevalg, billigere]
                  .filter((e): e is NonNullable<typeof e> => Boolean(e))
                  // Foerstevalget kan ogsaa vaere det billigere alternativ.
                  .filter((e, i, l) => l.findIndex((x) => x.product.id === e.product.id) === i)
                  .map((e) => (
                    <Link
                      key={e.product.id}
                      href={`/grej/${produktSlug(rentNavn(e.product))}`}
                      className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white p-3.5 hover:border-accent"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                        <ProduktBillede
                          src={e.product.image_url}
                          alt=""
                          fill
                          className="object-contain"
                          sizes="64px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-accent-dark">
                          {e.award_label ?? "I samme guide"}
                          {e.score != null && ` · ${formatScore(e.score)}`}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold text-primary">
                          {rentNavn(e.product)}
                        </p>
                        <p className="mt-0.5 text-xs text-primary/60">{kr(e.product.price)}</p>
                      </div>
                    </Link>
                  ))}
              </div>
            </>
          )}

          <p className="mt-4 text-sm">
            <Link href={`/bedste/${guide.slug}`} className="font-bold text-accent-dark hover:text-primary">
              Se alle {antalIGuiden} i guiden ›
            </Link>
          </p>

          {ogsaaI.length > 0 && (
            <p className="mt-3 text-sm leading-relaxed text-primary/70">
              Står også i{" "}
              {ogsaaI.map((g, i) => (
                <span key={g.slug}>
                  {i > 0 && ", "}
                  <Link href={`/bedste/${g.slug}`} className="underline hover:text-accent">
                    {g.title}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </aside>
      </div>

      <p className="mt-12 max-w-[80ch] border-t border-primary/10 pt-5 text-xs leading-relaxed text-primary/60">
        Pris og lager er hentet fra butikkerne og kan være ændret siden. Vi køber ikke produkterne
        selv: vurderingen bygger på producentens tal, butikkernes oplysninger og vores erfaring med
        shelterture i Danmark.{" "}
        <Link href="/annoncer-og-partnere" className="underline hover:text-accent">
          Om annoncer og partnere
        </Link>
      </p>
    </main>
  );
}
