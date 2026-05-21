"use client";

import { useState, useEffect, useRef } from "react";
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
  Instagram,
  Send,
  Camera,
  Star,
} from "lucide-react";
import { AdminPhotoReview, type AdminSummaryCounts } from "@/components/AdminPhotoReview";
import type { TabKey } from "@/components/AdminPhotoReview";

const STORAGE_KEY = "shelterdk-admin-secret";
type AdminBadgeKey = keyof AdminSummaryCounts;
type AdminNavItem = {
  href?: string;
  icon: typeof Tent;
  title: string;
  desc: string;
  badgeKey?: AdminBadgeKey;
  tabKey?: TabKey;
};
type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Kræver handling",
    items: [
      {
        icon: MessageSquare,
        title: "Kontaktbeskeder",
        desc: "Henvendelser fra brugere",
        badgeKey: "contact",
        tabKey: "contact",
      },
      {
        href: "/admin/shelter-ansogninger",
        icon: Tent,
        title: "Shelter-ansøgninger",
        desc: "Nye shelters til godkendelse",
        badgeKey: "submissions",
      },
      {
        href: "/admin/booking-monitor",
        icon: Activity,
        title: "Booking monitor",
        desc: "Aktive og fejlede bookings",
        badgeKey: "bookingMonitor",
      },
    ],
  },
  {
    label: "Booking & drift",
    items: [
      { href: "/admin/shelters", icon: Tent, title: "Bookable shelters", desc: "Administrér shelters med booking" },
      { href: "/admin/bookinger", icon: BookOpen, title: "Bookinger", desc: "Oversigt over alle bookings" },
      { href: "/admin/payments", icon: CreditCard, title: "Betalinger", desc: "Betalingsstatus og Stripe" },
      { href: "/admin/email-log", icon: Mail, title: "Email-log", desc: "Sendte e-mails og leveringsstatus" },
      { href: "/admin/redirects", icon: CornerDownRight, title: "Redirects", desc: "URL-omdirigeringer" },
    ],
  },
  {
    label: "Kanaler & vækst",
    items: [
      {
        href: "/admin/instagram",
        icon: Instagram,
        title: "Instagram",
        desc: "Kurater opslag til ShelterDK",
        badgeKey: "instagram",
      },
      {
        href: "/admin/nyhedsbrev",
        icon: Send,
        title: "Nyhedsbrev",
        desc: "Nye tilmeldinger og eksport",
        badgeKey: "newsletter",
      },
    ],
  },
  {
    label: "Indhold & moderation",
    items: [
      {
        icon: Camera,
        title: "Billeder",
        desc: "Billeder der venter på godkendelse",
        badgeKey: "photos",
        tabKey: "photos",
      },
      {
        icon: MessageSquare,
        title: "Community",
        desc: "Kommentarer og facilitetsbidrag",
        badgeKey: "community",
        tabKey: "community",
      },
      {
        icon: Star,
        title: "Oplevelser",
        desc: "Brugeroplevelser og historier",
        badgeKey: "oplevelser",
        tabKey: "oplevelser",
      },
    ],
  },
] as const;

export default function AdminIndexPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("photos");
  const panelRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<AdminSummaryCounts>({
    photos: 0,
    community: 0,
    instagram: 0,
    newsletter: 0,
    contact: 0,
    oplevelser: 0,
    submissions: 0,
    bookinger: 0,
    bookingMonitor: 0,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setSecret(stored ?? null);
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
        <div className="mb-10 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-primary/35 uppercase tracking-wider mb-2.5">
                {group.label}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {group.items.map(({ href, icon: Icon, title, desc, badgeKey, tabKey }) => {
                  const badgeCount = badgeKey ? summary[badgeKey] : 0;
                  const classes =
                    "relative flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 hover:border-accent/30 hover:bg-accent/[0.02] transition-all group shadow-sm shadow-primary/[0.03] text-left w-full";
                  const content = (
                    <>
                    {badgeCount > 0 && (
                      <span className="absolute right-10 top-3 inline-flex min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-white shadow-sm">
                        {badgeCount}
                      </span>
                    )}
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
                    </>
                  );

                  if (href) {
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={classes}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => {
                        if (!tabKey) return;
                        setActiveTab(tabKey);
                        setTimeout(() => {
                          panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 30);
                      }}
                      className={classes}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={panelRef}>
        <AdminPhotoReview
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showManagementTabs={false}
          showModerationTabs={false}
          onSecretChange={setSecret}
          onSummaryChange={setSummary}
        />
      </div>
    </div>
  );
}
