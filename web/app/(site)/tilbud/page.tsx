import type { Metadata } from "next";
import Link from "next/link";
import {
  getTopDeals,
  getWhitelistedCategories,
  type DealsFilter,
} from "@/lib/affiliate-deals";
import { GearCard } from "@/components/GearCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ugens bedste outdoor-tilbud",
  description:
    "De største prisfald på telte, soveposer, pandelamper og outdoor-grej — kurateret dagligt fra vores partnere.",
  alternates: { canonical: "/tilbud" },
};

const CATEGORY_LABELS: Record<string, string> = {
  telt: "Telte",
  sovepose: "Soveposer",
  liggeunderlag: "Liggeunderlag",
  soveudstyr: "Soveudstyr",
  haengekoje: "Hængekøjer",
  rygsaek: "Rygsække",
  taske: "Tasker",
  pandelampe: "Pandelamper",
  lygte: "Lygter",
  kogeudstyr: "Kogeudstyr",
  drikkedunk: "Drikkedunke",
  vandfilter: "Vandfiltre",
  regntoj: "Regntøj",
  jakke: "Jakker",
  bukser: "Bukser",
  fodtoj: "Fodtøj",
  kniv: "Knive & værktøj",
  foerstehjaelp: "Førstehjælp",
  campingmobler: "Campingmøbler",
  kikkert: "Kikkerter",
  tarp: "Tarps",
  sokker: "Sokker",
  elektronik: "Elektronik",
  navigation: "Navigation",
  hygiejne: "Hygiejne",
  vand: "Vandaktiviteter",
  cykel: "Cykel",
  fiskeri: "Fiskeri",
  hund: "Hund",
  boern: "Børn",
};

const SORT_OPTIONS = [
  { value: "discount", label: "Største rabat" },
  { value: "price-asc", label: "Laveste pris" },
  { value: "price-desc", label: "Højeste pris" },
] as const;

const RETAILER_LABELS: Record<string, string> = {
  backpackerlife: "Backpackerlife",
  outdoortid: "Outdoortid",
  outmore: "Outmore",
};

interface PageProps {
  searchParams: Promise<{
    retailer?: string;
    category?: string;
    minDiscount?: string;
    sort?: string;
  }>;
}

function filterUrl(
  current: Record<string, string | undefined>,
  patch: Record<string, string | null>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return `/tilbud${qs ? `?${qs}` : ""}`;
}

export default async function TilbudPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const categories = await getWhitelistedCategories();
  const sort = (params.sort as DealsFilter["sort"]) ?? "discount";
  const deals = await getTopDeals({
    retailer: params.retailer,
    category: params.category,
    minDiscount: params.minDiscount
      ? parseInt(params.minDiscount, 10)
      : undefined,
    sort,
  });

  const hasFilters = !!(params.retailer || params.category || params.sort);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Tilbud</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
          Ugens bedste outdoor-tilbud
        </h1>
        <p className="mt-3 max-w-2xl text-primary/70">
          Vi har samlet de største prisfald på shelter- og outdoor-grej fra
          vores partnere. Opdateret dagligt. Leder du efter det bedste i en
          kategori, så se vores{" "}
          <Link href="/bedste" className="text-accent underline">
            købsguider til outdoor-grej
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-primary/50">
          Alle produkter her er affiliate-links.{" "}
          <Link href="/annoncer-og-partnere" className="underline">
            Læs om hvordan det virker →
          </Link>
        </p>
      </header>

      {/* Category pills — rel=nofollow: filter-URLs er kanonisk-dubletter af /tilbud. Spar crawl-budget. */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={filterUrl(params, { category: null })}
          rel="nofollow"
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            !params.category
              ? "border-accent bg-accent-dark text-white"
              : "border-primary/15 bg-white text-primary/70 hover:border-accent/30 hover:text-accent"
          }`}
        >
          Alle
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat}
            href={filterUrl(params, {
              category: cat === params.category ? null : cat,
            })}
            rel="nofollow"
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              params.category === cat
                ? "border-accent bg-accent-dark text-white"
                : "border-primary/15 bg-white text-primary/70 hover:border-accent/30 hover:text-accent"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </Link>
        ))}
      </div>

      {/* Sorting + retailer filter row — også nofollow for samme grund */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-primary/60">Sortér:</span>
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={filterUrl(params, {
                sort: opt.value === "discount" ? null : opt.value,
              })}
              rel="nofollow"
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                sort === opt.value
                  ? "border-primary bg-primary text-white"
                  : "border-primary/15 text-primary/60 hover:border-primary/30"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-primary/60">Forhandler:</span>
          <Link
            href={filterUrl(params, { retailer: null })}
            rel="nofollow"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !params.retailer
                ? "border-primary bg-primary text-white"
                : "border-primary/15 text-primary/60 hover:border-primary/30"
            }`}
          >
            Alle
          </Link>
          {Object.entries(RETAILER_LABELS).map(([val, label]) => (
            <Link
              key={val}
              href={filterUrl(params, {
                retailer: val === params.retailer ? null : val,
              })}
              rel="nofollow"
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                params.retailer === val
                  ? "border-primary bg-primary text-white"
                  : "border-primary/15 text-primary/60 hover:border-primary/30"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {hasFilters && (
          <Link
            href="/tilbud"
            className="text-xs text-accent underline hover:no-underline"
          >
            Ryd alle filtre
          </Link>
        )}
      </div>

      {/* Results */}
      {deals.length === 0 ? (
        <div className="rounded-xl bg-primary/5 py-16 text-center">
          <h2 className="font-serif text-xl text-primary">
            Ingen tilbud matcher filtrene
          </h2>
          <p className="mt-2 text-primary/60">
            Prøv at fjerne et filter eller kig tilbage snart.
          </p>
          {hasFilters && (
            <Link
              href="/tilbud"
              className="mt-4 inline-block text-sm text-accent underline"
            >
              Ryd filtre
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-primary/50">
            {deals.length} tilbud
            {params.category &&
              ` i ${CATEGORY_LABELS[params.category] ?? params.category}`}
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deals.map((p) => (
              <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-accent/20 bg-gradient-to-r from-amber-50 to-yellow-50 p-6 md:p-8 text-center">
            <h3 className="font-serif text-xl font-bold text-primary mb-2">
              Ved du hvad du skal pakke?
            </h3>
            <p className="text-primary/70 text-sm mb-4 max-w-lg mx-auto">
              Se vores komplette pakkeliste til sheltertur — så du ikke glemmer noget vigtigt.
            </p>
            <Link
              href="/guides/pakkeliste-til-sheltertur"
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark transition-colors"
            >
              Se pakkelisten
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
