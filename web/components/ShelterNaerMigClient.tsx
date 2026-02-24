"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { MapPin, Loader2 } from "lucide-react";

export interface NearbyShelterItem {
  title: string;
  slug: string;
  path: string;
  distance_km: number;
  region: string | null;
  kommune: string | null;
}

type Status = "idle" | "loading" | "success" | "error";

export function ShelterNaerMigClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shelters, setShelters] = useState<NearbyShelterItem[]>([]);

  const handleFind = useCallback(async () => {
    setErrorMessage(null);
    setStatus("loading");

    if (typeof window === "undefined" || !navigator?.geolocation) {
      setErrorMessage(
        "Din browser understøtter ikke placering. Prøv en nyere browser eller enhed."
      );
      setStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const res = await fetch(
            `/api/shelters/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setErrorMessage(
              data.error || "Kunne ikke hente shelters. Prøv igen senere."
            );
            setStatus("error");
            return;
          }
          const data = await res.json();
          setShelters(data.shelters ?? []);
          setStatus("success");
        } catch {
          setErrorMessage(
            "Der opstod en teknisk fejl ved hentning af shelters. Tjek din internetforbindelse og prøv igen."
          );
          setStatus("error");
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage(
            "Vi har brug for din lokation for at vise shelters i nærheden. Tillad adgang til placering i browserindstillingerne og prøv igen."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMessage(
            "Placering kunne ikke bestemmes. Tjek at GPS/lokation er slået til og prøv igen."
          );
        } else {
          setErrorMessage(
            "Der opstod en fejl ved hentning af din placering. Prøv igen senere."
          );
        }
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-primary/90 text-lg leading-relaxed mb-8">
        Find overnatning i naturen lige omkring dig. Klik på knappen nedenfor, så
        viser vi de nærmeste shelters baseret på din nuværende placering – hurtigt
        og uden at skulle søge efter by eller område.
      </p>

      <button
        type="button"
        onClick={handleFind}
        disabled={status === "loading"}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-semibold px-8 py-4 text-lg shadow-lg hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
        aria-busy={status === "loading"}
        aria-live="polite"
      >
        {status === "loading" ? (
          <>
            <Loader2 size={22} className="animate-spin shrink-0" aria-hidden />
            <span>Henter placering…</span>
          </>
        ) : (
          <>
            <MapPin size={22} className="shrink-0" aria-hidden />
            <span>Find nærmeste shelters</span>
          </>
        )}
      </button>

      {status === "error" && errorMessage && (
        <div
          role="alert"
          className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
        >
          {errorMessage}
        </div>
      )}

      {status === "success" && (
        <section
          className="mt-10"
          aria-label="Nærmeste shelters"
        >
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Nærmeste shelters
          </h2>
          {shelters.length === 0 ? (
            <p className="text-primary/70">
              Ingen shelters med placering fundet i databasen.
            </p>
          ) : (
            <ul className="space-y-3">
              {shelters.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={s.path}
                    className="flex items-center justify-between gap-4 rounded-xl border border-primary/10 bg-white/50 px-4 py-3 hover:border-accent/30 hover:bg-accent/5 transition-colors group"
                  >
                    <span className="font-medium text-primary group-hover:text-accent truncate">
                      {s.title}
                    </span>
                    <span className="text-primary/70 text-sm shrink-0">
                      {s.distance_km} km væk
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
