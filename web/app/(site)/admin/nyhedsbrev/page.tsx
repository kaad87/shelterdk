import type { Metadata } from "next";
import Link from "next/link";
import { AdminPhotoReview } from "@/components/AdminPhotoReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Nyhedsbrev | ShelterDK" },
};

export default function AdminNyhedsbrevPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Nyhedsbrev</span>
      </nav>
      <AdminPhotoReview initialTab="newsletter" />
    </div>
  );
}
