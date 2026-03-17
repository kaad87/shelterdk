import type { Metadata } from "next";
import Link from "next/link";
import { AdminPhotoReview } from "@/components/AdminPhotoReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminBillederPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/70">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="mx-1">/</span>
        <span className="text-primary">Admin – billeder</span>
      </nav>
      <AdminPhotoReview />
    </div>
  );
}
