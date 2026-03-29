import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Siden blev ikke fundet | ShelterDK",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <p className="text-accent font-medium text-sm mb-3">404</p>
      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary mb-2 text-center">
        Siden blev ikke fundet
      </h1>
      <p className="text-primary/70 text-center mb-8 max-w-md">
        Den side du leder efter findes ikke eller er flyttet.
      </p>
      <div className="flex flex-wrap gap-4 justify-center mb-12">
        <Link
          href="/"
          className="rounded-lg bg-accent text-white font-medium px-6 py-3 hover:bg-accent/90 transition-colors"
        >
          Gå til forsiden
        </Link>
        <Link
          href="/soeg"
          className="rounded-lg border border-primary/20 text-primary font-medium px-6 py-3 hover:bg-primary/5 transition-colors"
        >
          Søg shelters
        </Link>
      </div>
      <div className="max-w-sm w-full">
        <p className="text-primary/60 text-sm font-medium mb-3 text-center">Populære sider</p>
        <ul className="space-y-2 text-sm text-center">
          <li>
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">
              Shelters med toilet
            </Link>
          </li>
          <li>
            <Link href="/shelter-med-vand" className="text-accent hover:underline">
              Shelters med vand
            </Link>
          </li>
          <li>
            <Link href="/shelter-med-hund" className="text-accent hover:underline">
              Hundevenlige shelters
            </Link>
          </li>
          <li>
            <Link href="/shelter-naer-mig" className="text-accent hover:underline">
              Find shelter nær mig
            </Link>
          </li>
          <li>
            <Link href="/omraade" className="text-accent hover:underline">
              Shelters efter område
            </Link>
          </li>
          <li>
            <Link href="/faq" className="text-accent hover:underline">
              Ofte stillede spørgsmål
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
