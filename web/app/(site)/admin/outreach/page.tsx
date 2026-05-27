"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OutreachReviewQueue } from "@/components/OutreachReviewQueue";

const STORAGE_KEY = "shelterdk-admin-secret";

function OutreachContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSecret = searchParams.get("secret") ?? "";
  const [secret] = useState(() => {
    if (urlSecret) {
      sessionStorage.setItem(STORAGE_KEY, urlSecret);
      return urlSecret;
    }
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  });

  useEffect(() => {
    if (!urlSecret) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("secret");
    const next = params.toString();
    router.replace(next ? `?${next}` : "/admin/outreach", { scroll: false });
  }, [router, searchParams, urlSecret]);

  if (!secret) {
    return (
      <div className="rounded-xl border border-primary/10 bg-primary/[0.03] px-6 py-10 text-center text-sm text-primary/55">
        Ingen admin-secret. Tilføj <code className="bg-primary/5 px-1 rounded">?secret=XXX</code> til URL&apos;en
        eller log ind via admin-forsiden.
      </div>
    );
  }

  return <OutreachReviewQueue secret={secret} />;
}

export default function OutreachPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">Outreach til ejere</h1>
        <p className="text-sm text-primary/50 mt-1">
          Send personlige mails fra hej@shelterdk.dk til potentielle bookingsystem-kunder.
          Listen er rangeret efter outreach-potentiale (MobilePay, foreninger, mangler bookingsystem).
        </p>
      </div>
      <Suspense>
        <OutreachContent />
      </Suspense>
    </main>
  );
}
