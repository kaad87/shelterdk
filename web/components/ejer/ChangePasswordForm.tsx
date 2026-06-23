"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/utils/supabase/browser";

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Adgangskoderne matcher ikke");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Din session er udløbet. Log ind igen og prøv på ny.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setSuccess("Din adgangskode er ændret.");
    } catch {
      setError("Noget gik galt — prøv igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <Link
        href="/ejer/dashboard"
        className="inline-flex items-center gap-1 text-sm text-primary/45 hover:text-accent transition-colors mb-6"
      >
        ← Tilbage til mine shelters
      </Link>
      <h1 className="font-serif text-2xl font-bold text-primary mb-1">Skift adgangskode</h1>
      <p className="text-sm text-primary/50 mb-8">Vælg en ny adgangskode til din ejerkonto.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
            Ny adgangskode
          </label>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">
            Gentag adgangskode
          </label>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35 disabled:opacity-50"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{success}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-accent-dark text-white hover:bg-accent-dark/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Gemmer…" : "Gem ny adgangskode"}
        </button>
      </form>
    </div>
  );
}
