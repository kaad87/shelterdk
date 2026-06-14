import type { Metadata } from "next";
import Link from "next/link";
import { AdminNatureStays } from "@/components/AdminNatureStays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Naturophold | ShelterDK" },
};

export default function AdminNatureStaysPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Naturophold</span>
      </nav>
      <h1 className="mb-2 font-serif text-2xl font-bold text-primary">Naturophold (glamping)</h1>
      <p className="mb-6 text-sm text-primary/60">
        Kuraterede betalte naturophold. Et sted kan kun publiceres med billede + dokumenteret billedtilladelse.
      </p>
      <AdminNatureStays />
    </div>
  );
}
