import { ArrowDown } from "lucide-react";

/**
 * "3 varer faldet i pris" på et link til en købsguide.
 *
 * Tallet kommer fra lib/guide-prisfald.ts og tæller kun varer, vi selv har set
 * falde, med samme regel som guidesiden. Ingen procent og ingen dato: siderne
 * med maerket er ofte statiske og kan være timer gamle, og et antal varer
 * flytter sig langsomt. Procenten og datoen står på guiden selv.
 */
export function PrisfaldMaerke({ antal, className }: { antal: number | undefined; className?: string }) {
  if (!antal || antal < 1) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent-dark px-2 py-0.5 text-[11px] font-semibold leading-tight text-white ${className ?? ""}`}
    >
      <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
      {antal === 1 ? "1 vare faldet i pris" : `${antal} varer faldet i pris`}
    </span>
  );
}
