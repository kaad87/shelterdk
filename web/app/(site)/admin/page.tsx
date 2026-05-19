"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Tent,
  BookOpen,
  CreditCard,
  Activity,
  Mail,
  MessageSquare,
  CornerDownRight,
  ArrowRight,
} from "lucide-react";
import { AdminPhotoReview } from "@/components/AdminPhotoReview";

const STORAGE_KEY = "shelterdk-admin-secret";

const NAV_GROUPS = [
  {
    label: "Booking & økonomi",
    items: [
      { href: "/admin/shelters", icon: Tent, title: "Bookable shelters", desc: "Administrér shelters med booking" },
      { href: "/admin/bookinger", icon: BookOpen, title: "Bookinger", desc: "Oversigt over alle bookings" },
      { href: "/admin/payments", icon: CreditCard, title: "Betalinger", desc: "Betalingsstatus og Stripe" },
      { href: "/admin/booking-monitor", icon: Activity, title: "Booking monitor", desc: "Aktive og fejlede bookings" },
    ],
  },
  {
    label: "Drift & support",
    items: [
      { href: "/admin/email-log", icon: Mail, title: "Email-log", desc: "Sendte e-mails og leveringsstatus" },
      { href: "/admin/kontakt", icon: MessageSquare, title: "Kontaktbeskeder", desc: "Henvendelser fra brugere" },
      { href: "/admin/shelter-ansogninger", icon: Tent, title: "Shelter-ansøgninger", desc: "Nye shelters til godkendelse" },
      { href: "/admin/redirects", icon: CornerDownRight, title: "Redirects", desc: "URL-omdirigeringer" },
    ],
  },
] as const;

export default function AdminIndexPage() {
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setSecret(stored ?? null);

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
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-primary/35 uppercase tracking-wider mb-2.5">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.items.map(({ href, icon: Icon, title, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 hover:border-accent/30 hover:bg-accent/[0.02] transition-all group shadow-sm shadow-primary/[0.03]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/[0.04] flex items-center justify-center shrink-0 group-hover:bg-accent/[0.08] transition-colors">
                      <Icon
                        size={15}
                        className="text-primary/45 group-hover:text-accent transition-colors"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary leading-tight">{title}</p>
                      <p className="text-xs text-primary/40 mt-0.5">{desc}</p>
                    </div>
                    <ArrowRight
                      size={13}
                      className="text-primary/15 group-hover:text-accent/40 group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminPhotoReview />
    </div>
  );
}
