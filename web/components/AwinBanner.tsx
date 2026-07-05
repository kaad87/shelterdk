"use client";

import { trackAffiliateClick } from "@/lib/tracking";

/**
 * Statisk Awin-affiliate-banner (Outnorth DK). Rå <img> (Awins cshow.php er
 * også visnings-tracker → må ikke proxy'es/caches), sponsoreret link via cread.php.
 * Ingen script/CSP-ændring nødvendig. Diskret "Annonce"-label.
 * Klik trackes som affiliate_click (placement: awin_banner), så bannerets
 * performance kan sammenlignes med Partner-ads-fladerne.
 */
export function AwinBanner({ className }: { className?: string }) {
  return (
    <aside className={`my-8 flex flex-col items-center ${className ?? ""}`} aria-label="Annonce">
      <span className="mb-1 text-[11px] uppercase tracking-wide text-primary/40">Annonce</span>
      <a
        href="https://www.awin1.com/cread.php?s=4801251&v=18621&q=593392&r=2839504"
        target="_blank"
        rel="sponsored nofollow noopener"
        onClick={() =>
          trackAffiliateClick({
            url: "https://www.awin1.com/cread.php?s=4801251&v=18621&q=593392&r=2839504",
            productName: "Outnorth banner",
            retailer: "outnorth",
            position: "awin_banner",
          })
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://www.awin1.com/cshow.php?s=4801251&v=18621&q=593392&r=2839504"
          alt="Outnorth – outdoor-udstyr"
          loading="lazy"
          className="max-w-full"
        />
      </a>
    </aside>
  );
}
