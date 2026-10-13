import type { Metadata } from "next";
import Link from "next/link";
import { AdminAffiliatePerformance } from "@/components/AdminAffiliatePerformance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Performance | ShelterDK" },
};

export default function AdminPerformancePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="transition-colors hover:text-accent">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="transition-colors hover:text-accent">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Performance</span>
      </nav>
      <h1 className="mb-1 font-serif text-2xl font-bold text-primary">Affiliate-performance</h1>
      <p className="mb-6 max-w-2xl text-sm text-primary/60">
        Udviklingen i affiliate-klik, hvor de kommer fra, og hvad guiderne er i stand til at
        sælge. Grej og shelters opgøres hver for sig — en enkelt bygning til 20.000 kr. ville
        ellers overdøve en måneds soveposer. Opdaterer sig selv hvert 5. minut.
      </p>
      <AdminAffiliatePerformance />
    </div>
  );
}
