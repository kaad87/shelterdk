"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailPrefill = searchParams.get("email") ?? "";
  const claimPrefill = searchParams.get("claim") ?? "";
  const [form, setForm] = useState({ email: searchParams.get("email") ?? "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signupHref = `/ejer/signup?email=${encodeURIComponent(form.email || emailPrefill)}${claimPrefill ? `&claim=${encodeURIComponent(claimPrefill)}` : ""}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ejer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Noget gik galt"); return; }
      const requestedNext = searchParams.get("next");
      const claim = searchParams.get("claim");
      const next =
        requestedNext &&
        requestedNext.startsWith("/ejer") &&
        !requestedNext.startsWith("//")
          ? requestedNext
          : claim
            ? `/ejer/claim?claim=${encodeURIComponent(claim)}`
          : "/ejer/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Noget gik galt — prøv igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-serif text-2xl font-bold text-primary mb-1">Log ind</h1>
      <p className="text-sm text-primary/50 mb-8">Ejer-portal · ShelterDK</p>

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
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Adgangskode</label>
          <input
            type="password" required autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-accent text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
        >
          {loading ? "Logger ind…" : "Log ind"}
        </button>
        <p className="text-center text-sm">
          <Link href="/ejer/glemt-adgangskode" className="text-primary/50 hover:text-primary hover:underline">
            Glemt adgangskode?
          </Link>
        </p>
        <p className="text-center text-sm text-primary/50">
          Ingen konto?{" "}
          <Link href={signupHref} className="text-accent hover:underline">Opret her</Link>
        </p>
      </form>
    </div>
  );
}
