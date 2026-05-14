"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminPhotoReview } from "@/components/AdminPhotoReview";

const STORAGE_KEY = "shelterdk-admin-secret";

export default function AdminIndexPage() {
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setSecret(stored ?? null);

    // Re-check whenever sessionStorage is updated (login/logout in AdminPhotoReview)
    const interval = setInterval(() => {
      const current = sessionStorage.getItem(STORAGE_KEY);
      setSecret((prev) => (prev !== current ? current : prev));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Admin</span>
      </nav>

      {secret && (
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
          <Link
            href="/admin/booking-monitor"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            🚨 Booking monitor
          </Link>
          <Link
            href="/admin/email-log"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            ✉️ Email-log
          </Link>
          <Link
            href="/admin/redirects"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            ↪️ Redirects
          </Link>
          <Link
            href="/admin/kontakt"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent transition-colors"
          >
            💬 Kontaktbeskeder
          </Link>
        </div>
      )}

      <AdminPhotoReview />
    </div>
  );
}
