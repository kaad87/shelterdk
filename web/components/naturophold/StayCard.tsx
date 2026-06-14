import { MapPin } from "lucide-react";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import type { NatureStay } from "@/lib/nature-stays";
import { StayAffiliateLink } from "@/components/naturophold/StayAffiliateLink";

const TYPE_LABEL: Record<string, string> = {
  glamping_telt: "Glampingtelt",
  naturhytte: "Naturhytte",
  dome: "Dome",
  traehus: "Træhus",
  tiny_house: "Tiny house",
  luksus_shelter: "Luksus-shelter",
  andet: "Naturophold",
};

interface StayCardProps {
  stay: Pick<NatureStay, "name" | "type" | "region" | "place" | "image_url" | "price_from" | "booking_url" | "link_source">;
  awardLabel?: string | null;
  bestFor?: string | null;
  editorialNote?: string | null;
  distanceKm?: number | null;
  position: "naturophold_guide" | "naturophold_planb";
}

/** Kort til et naturophold — bruges af guide-sider og Plan B-sektionen. */
export function StayCard({ stay, awardLabel, bestFor, editorialNote, distanceKm, position }: StayCardProps) {
  const img = stay.image_url ? getProxiedImageSrc(stay.image_url, { w: 600, q: 70 }) : null;
  const place = [stay.place, stay.region].filter(Boolean).join(", ");
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white">
      <div className="relative aspect-[4/3] bg-primary/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={stay.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/30">Intet billede</div>
        )}
        {awardLabel && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">{awardLabel}</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">{TYPE_LABEL[stay.type] ?? "Naturophold"}</p>
        <h3 className="mt-0.5 font-serif text-lg font-bold text-primary">{stay.name}</h3>
        {(place || distanceKm != null) && (
          <p className="mt-1 flex items-center gap-1 text-sm text-primary/60">
            <MapPin size={13} aria-hidden="true" />
            {place}
            {distanceKm != null && <span className="text-primary/50">· {distanceKm} km herfra</span>}
          </p>
        )}
        {bestFor && <p className="mt-2 text-sm font-medium text-primary/80">Bedst til: {bestFor}</p>}
        {editorialNote && <p className="mt-1 text-sm text-primary/70">{editorialNote}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          {typeof stay.price_from === "number" ? (
            <span className="text-sm text-primary/70">fra <span className="font-semibold text-primary">{stay.price_from} kr</span>/nat</span>
          ) : <span />}
          <StayAffiliateLink name={stay.name} url={stay.booking_url} linkSource={stay.link_source} priceFrom={stay.price_from} position={position} />
        </div>
      </div>
    </div>
  );
}
