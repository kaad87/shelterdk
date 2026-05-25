"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookingCandidateReviewQueue } from "@/components/BookingCandidateReviewQueue";

const STORAGE_KEY = "shelterdk-admin-secret";

function BookingKandidaterContent() {
  const searchParams = useSearchParams();
  const urlSecret = searchParams.get("secret") ?? "";
  const [secret] = useState(() => {
    if (urlSecret) {
      sessionStorage.setItem(STORAGE_KEY, urlSecret);
      return urlSecret;
    }
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  });

  if (!secret) {
    return (
      <div className="rounded-xl border border-primary/10 bg-primary/[0.03] px-6 py-10 text-center text-sm text-primary/55">
        Ingen admin-secret. Tilføj <code className="bg-primary/5 px-1 rounded">?secret=XXX</code> til URL&apos;en
        eller log ind via admin-forsiden.
      </div>
    );
  }

  return <BookingCandidateReviewQueue secret={secret} />;
}

export default function BookingKandidaterPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-primary">Bookingkandidater</h1>
        <p className="text-sm text-primary/50 mt-1">
          Shelters der muligvis kan bookes, men endnu ikke er registreret i systemet.
        </p>
      </div>
      <Suspense>
        <BookingKandidaterContent />
      </Suspense>
    </main>
  );
}
