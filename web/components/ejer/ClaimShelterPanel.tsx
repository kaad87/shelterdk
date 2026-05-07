"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ClaimShelterPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claim = searchParams.get("claim") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Knytter shelter til din konto…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!claim) {
        if (!cancelled) {
          setState("error");
          setMessage("Invite-linket mangler claim-token.");
        }
        return;
      }

      try {
        const res = await fetch("/api/ejer/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim_token: claim }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setState("error");
            setMessage(data.error ?? "Kunne ikke knytte shelteret til din konto.");
          }
          return;
        }
        if (!cancelled) {
          setState("success");
          setMessage(
            data.sheltersLinked > 0
              ? "Shelteret er nu knyttet til din konto."
              : "Shelteret var allerede knyttet eller der var intet nyt at knytte."
          );
          setTimeout(() => {
            router.push("/ejer/dashboard");
            router.refresh();
          }, 1000);
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Noget gik galt under tilknytningen.");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [claim, router]);

  return (
    <div className="max-w-md mx-auto rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
      <h1 className="font-serif text-2xl font-bold text-primary mb-2">Knyt shelter til konto</h1>
      <p
        className={`text-sm ${
          state === "error"
            ? "text-red-600"
            : state === "success"
              ? "text-emerald-700"
              : "text-primary/60"
        }`}
      >
        {message}
      </p>
      {state === "loading" && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}
      {state === "error" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/ejer/dashboard"
            className="rounded-xl border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Til dashboard
          </Link>
          <Link
            href="/ejer/login"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Log ind igen
          </Link>
        </div>
      )}
    </div>
  );
}
