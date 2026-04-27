import { getProduct, type AffiliateProduct } from "@/lib/affiliate-products";
import { GearCardView } from "./GearCardClient";

export type { GearCardVariant } from "./GearCardClient";
export { GearCardView } from "./GearCardClient";

export interface GearCardProps {
  id: string;
  variant?: import("./GearCardClient").GearCardVariant;
  className?: string;
  /** When provided, skips DB fetch (for pre-fetched bulk renders) */
  preloaded?: AffiliateProduct | null;
}

/** Server Component — fetches product data, delegates rendering to GearCardView (Client Component). */
export async function GearCard({
  id,
  variant = "editorial",
  className,
  preloaded,
}: GearCardProps) {
  const product = preloaded ?? (await getProduct(id));
  if (!product) {
    return <span data-gearcard-missing={id} style={{ display: "none" }} />;
  }
  if (product.is_blocked) return null;
  return <GearCardView product={product} variant={variant} className={className} />;
}
