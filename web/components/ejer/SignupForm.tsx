"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailPrefill = searchParams.get("email") ?? "";
  const claimPrefill = searchParams.get("claim") ?? "";
  const hasInviteLink = claimPrefill.length > 0;
  const [form, setForm] = useState({
    email: emailPrefill,
    password: "",
    claim_token: claimPrefill,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ejer/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      if (data.sheltersLinked === 0) {
        setError("Vi fandt ingen shelter med denne email. Kontakt os på kontakt@shelterdk.dk, så linker vi din konto manuelt.");
        return;
      }
      router.push("/ejer/dashboard");
      router.refresh();
    } catch {
      setError("Noget gik galt — prøv igen");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/ejer/login?email=${encodeURIComponent(form.email || emailPrefill)}${claimPrefill ? `&next=${encodeURIComponent(`/ejer/claim?claim=${claimPrefill}`)}` : ""}`;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-serif text-2xl font-bold text-primary mb-1">Opret konto</h1>
      <p className="text-sm text-primary/50 mb-6">
        {hasInviteLink
          ? "Invitelink fundet. Brug den email der er tilknyttet dit shelter, og vælg en adgangskode."
          : "Du skal åbne invitelinket fra din email for at oprette en ejerkonto."}
      </p>

      {hasInviteLink ? (
        <>
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Vi har allerede fundet dit invitelink. Du skal bare udfylde email og adgangskode.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email" required autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
                Adgangskode <span className="normal-case font-normal text-primary/35">mindst 8 tegn</span>
              </label>
              <input
                type="password" required autoComplete="new-password" minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
              />
            </div>
            <input type="hidden" value={form.claim_token} readOnly />
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold bg-accent-dark text-white hover:bg-accent-dark/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Opretter konto…" : "Opret konto"}
            </button>
            <p className="text-center text-sm text-primary/50">
              Har du allerede en konto?{" "}
              <Link href={loginHref} className="text-accent hover:underline">Log ind</Link>
            </p>
          </form>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            For at beskytte shelter-ejere kræver konto-oprettelse et personligt invitelink. Hvis du mangler linket, skal admin sende et nyt til dig.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/ejer/login"
              className="rounded-xl bg-accent-dark px-4 py-3 text-center text-sm font-semibold text-white hover:bg-accent-dark/90 transition-colors"
            >
              Jeg har allerede en konto
            </Link>
            <a
              href="mailto:kontakt@shelterdk.dk?subject=Mangler%20invitelink%20til%20ejerportal"
              className="rounded-xl border border-primary/15 px-4 py-3 text-center text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              Kontakt ShelterDK
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
