"use client";

import { ExternalLink } from "lucide-react";
import { trackAffiliateClick } from "@/lib/tracking";
import {
  PARTNER_SHELTERS,
  PRICES_CHECKED,
  partnerAdsLink,
  formatDkk,
  isPriceStale,
  type PartnerShelter,
} from "@/lib/partner-shelters";

function Card({ p, stale }: { p: PartnerShelter; stale: boolean }) {
  const href = partnerAdsLink(p.url);
  const onSale = p.priceOriginalDkk != null && p.priceOriginalDkk > p.priceDkk;
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener"
      onClick={() =>
        trackAffiliateClick({
          url: href,
          productName: p.name,
          retailer: "solundhuse",
          category: p.accessory ? "shelter-tilbehoer" : "shelter",
          position: "product",
          priceDkk: p.priceDkk,
        })
      }
      className="flex flex-col rounded-xl border border-primary/15 bg-white/60 p-4 transition-colors hover:border-accent/40"
    >
      <span className="font-semibold text-primary">{p.name}</span>
      <span className="mt-1 text-sm text-primary/70">{p.note}</span>
      <span className="mt-3 flex items-baseline gap-2">
        {stale ? (
          <span className="text-sm text-primary/60">Se aktuel pris</span>
        ) : (
          <>
            <span className="text-lg font-bold text-primary">{formatDkk(p.priceDkk)}</span>
            {onSale && (
              <span className="text-sm text-primary/50 line-through">{formatDkk(p.priceOriginalDkk!)}</span>
            )}
          </>
        )}
        {p.areaM2 && <span className="text-sm text-primary/60">· {String(p.areaM2).replace(".", ",")} m²</span>}
      </span>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
        Se hos Sølund Huse
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </span>
    </a>
  );
}

/**
 * Købsblok på /koeb-shelter. 39% af sidens søgninger er ren købsintent, men
 * grej-katalogets tre forhandlere sælger ikke træ-shelters — det gør denne
 * annoncør.
 */
export function PartnerShelterCards() {
  const stale = isPriceStale(PRICES_CHECKED);
  const shelters = PARTNER_SHELTERS.filter((p) => !p.accessory);
  const accessories = PARTNER_SHELTERS.filter((p) => p.accessory);
  const checked = new Date(PRICES_CHECKED).toLocaleDateString("da-DK", { day: "numeric", month: "long" });

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shelters.map((p) => (
          <Card key={p.url} p={p} stale={stale} />
        ))}
      </div>
      {accessories.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accessories.map((p) => (
            <Card key={p.url} p={p} stale={stale} />
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-primary/60">
        {stale
          ? "Priserne er ikke verificeret for nylig — tjek den aktuelle pris hos forhandleren."
          : `Priser tjekket ${checked} hos Sølund Huse. Vi får provision hvis du køber via linket — det koster ikke dig ekstra.`}
      </p>
    </div>
  );
}
