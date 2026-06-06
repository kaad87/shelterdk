import type { Metadata } from "next";
import Link from "next/link";
import { AdminBuyingGuides } from "@/components/AdminBuyingGuides";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Købsguider | ShelterDK" },
};

export default function AdminBuyingGuidesPage() {
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
        <span className="font-medium text-primary">Købsguider</span>
      </nav>
      <h1 className="mb-6 font-serif text-2xl font-bold text-primary">Købsguider</h1>
      <AdminBuyingGuides />
    </div>
  );
}
