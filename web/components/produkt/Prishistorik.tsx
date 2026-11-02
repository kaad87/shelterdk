import type { Prispunkt } from "@/lib/produktside";

function kr(n: number): string {
  return `${Math.round(n).toLocaleString("da-DK")} kr.`;
}

function dato(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Prisudviklingen som en trappe.
 *
 * Kun aendringer logges (se migrations/067), saa punkterne er netop de dage
 * prisen flyttede sig. Derfor trappe og ikke en glat kurve: linjen mellem to
 * punkter betyder "prisen stod stille", og en skraa linje ville paastaa en
 * bevaegelse der ikke skete.
 *
 * Under to punkter tegnes ingenting. En kurve med ét punkt er en prik, og en
 * tom akse ser ud som om noget er i stykker.
 */
export function Prishistorik({ punkter }: { punkter: Prispunkt[] }) {
  if (punkter.length < 2) {
    return (
      <p className="text-sm text-primary/60">
        Vi gemmer prisen, hver gang den ændrer sig. Kurven tegnes, når der er mindst to målinger.
      </p>
    );
  }

  const priser = punkter.map((p) => p.price);
  const lav = Math.min(...priser);
  const hoej = Math.max(...priser);
  // Fladt forloeb: uden spaendet ville alt divideres med nul.
  const spaend = hoej - lav || 1;

  const B = 560;
  const H = 140;
  const top = 12;
  const bund = H - 28;
  const venstre = 54;

  const x = (i: number) => venstre + ((B - venstre - 8) * i) / (punkter.length - 1);
  const y = (v: number) => bund - ((bund - top) * (v - lav)) / spaend;

  // Trappe: vandret til naeste dato, derefter lodret til den nye pris.
  const d = punkter
    .map((p, i) => (i === 0 ? `M ${x(0)} ${y(p.price)}` : `H ${x(i)} V ${y(p.price)}`))
    .join(" ");

  const sidste = punkter[punkter.length - 1];

  return (
    <div>
      <p className="mb-3 text-sm text-primary/60">
        Vi gemmer prisen, hver gang den ændrer sig. {punkter.length} målinger siden{" "}
        {dato(punkter[0].observeret)}.
      </p>
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Prisen er gaaet fra ${kr(punkter[0].price)} den ${dato(punkter[0].observeret)} til ${kr(sidste.price)} den ${dato(sidste.observeret)}. Laveste maalte pris er ${kr(lav)}.`}
      >
        <line x1={venstre} y1={y(hoej)} x2={B - 8} y2={y(hoej)} stroke="rgba(44,62,80,0.10)" />
        <line x1={venstre} y1={y(lav)} x2={B - 8} y2={y(lav)} stroke="rgba(44,62,80,0.10)" />
        <text x={venstre - 8} y={y(hoej) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
          {Math.round(hoej).toLocaleString("da-DK")}
        </text>
        <text x={venstre - 8} y={y(lav) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
          {Math.round(lav).toLocaleString("da-DK")}
        </text>
        <path d={d} fill="none" stroke="#2C3E50" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={x(punkter.length - 1)} cy={y(sidste.price)} r="4" fill="#2C3E50" />
        <text x={venstre} y={H - 6} fontSize="11" fill="#6B7280">
          {dato(punkter[0].observeret)}
        </text>
        <text x={B - 8} y={H - 6} textAnchor="end" fontSize="11" fill="#6B7280">
          {dato(sidste.observeret)}
        </text>
      </svg>
      <p className="mt-2 text-sm text-primary/70">
        Laveste målte pris: <strong className="text-primary">{kr(lav)}</strong>
      </p>
    </div>
  );
}
