"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackKampagneBaandClick } from "@/lib/tracking";

/**
 * Sider hvor båndet ikke hører hjemme: selve landingssiden, og de steder hvor
 * nogen er midt i en booking eller arbejder i admin.
 */
const SKJULT = ["/black-friday", "/admin", "/owner", "/book", "/booking", "/min-booking", "/aktiver-booking"];

function erSkjult(sti: string): boolean {
  // Helt stiled: "/book" må ikke skjule "/booking-guide".
  return SKJULT.some((p) => sti === p || sti.startsWith(`${p}/`));
}

/**
 * Selve båndet. Klientkomponent alene fordi stien skal kendes; om det er
 * sæson afgøres på serveren i KampagneBaand.
 *
 * Hele båndet er ét link, så trykfladen er 44 px høj på mobil. Det kan ikke
 * lukkes: en luk-knap ville først kunne skjule det efter hydrering, og så
 * hopper hele siden 40 px op for dem der har lukket det.
 */
export function KampagneBaandLink({ aar }: { aar: number }) {
  const sti = usePathname() ?? "/";
  if (erSkjult(sti)) return null;
  return (
    <Link
      href="/black-friday"
      onClick={() => trackKampagneBaandClick()}
      className="block bg-primary text-white transition-colors hover:bg-[#1A2530] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E9D8B4] print:hidden"
    >
      <span className="mx-auto flex min-h-11 max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-[13px] leading-snug sm:min-h-10 sm:text-sm">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
        {/* Mobil skal stå på én linje ned til 320 px. Med "kun ægte
            prisfald. Se prisfaldene" brækkede den ved 375 px, og pilen stod
            alene på linje to. Linkteksten og pilen holdes sammen (nowrap). */}
        <span>
          <strong className="font-semibold text-[#E9D8B4]">Black Friday {aar}</strong>
          <span className="hidden sm:inline">: vi viser kun grej, der faktisk er faldet i pris.</span>
          <span className="sm:hidden">:</span>{" "}
          <span className="whitespace-nowrap">
            <span className="underline underline-offset-4">
              <span className="hidden sm:inline">Se prisfaldene</span>
              <span className="sm:hidden">se de ægte prisfald</span>
            </span>
            <span aria-hidden="true"> →</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
