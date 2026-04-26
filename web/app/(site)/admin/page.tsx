import type { Metadata } from "next";
import Link from "next/link";
import { AdminPhotoReview } from "@/components/AdminPhotoReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin | ShelterDK" },
};

export default function AdminIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Admin</span>
      </nav>
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/admin/shelters"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
        >
          🏕️ Bookable shelters
        </Link>
        <Link
          href="/admin/bookinger"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
        >
          📋 Bookinger
        </Link>
        <Link
          href="/admin/payments"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
        >
          💳 Betalinger
        </Link>
      </div>
      <AdminPhotoReview />
    </div>
  );
}
