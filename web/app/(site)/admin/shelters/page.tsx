"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  owner_email: string;
  owner_token: string;
  max_persons: number;
  description: string | null;
  created_at: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs px-2 py-0.5 rounded border border-primary/20 hover:bg-primary/5 transition-colors shrink-0"
    >
      {copied ? "✓" : "Kopiér"}
    </button>
  );
}

const STORAGE_KEY = "shelterdk-admin-secret";

function AdminSheltersContent() {
  const searchParams = useSearchParams();
  // Prefer sessionStorage (set by AdminPhotoReview login); fall back to URL param for direct access
  const urlSecret = searchParams.get("secret") ?? "";
  const [secret, setSecret] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    }
    return urlSecret;
  });

  useEffect(() => {
    if (urlSecret && typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, urlSecret);
      setSecret(urlSecret);
    }
  }, [urlSecret]);

  const [shelters, setShelters] = useState<BookableShelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [form, setForm] = useState({
    slug: "", title: "", owner_email: "", max_persons: "6", description: "", booking_mode: "shelterdk", payment_mode: "after_confirmation", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://shelterdk.dk";

  const authHeaders = { "x-admin-secret": secret };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/shelters`, { headers: authHeaders });
    if (res.status === 401) { setAuthError(true); setLoading(false); return; }
    const data = await res.json();
    setShelters(data.shelters ?? []);
    setLoading(false);
  }, [secret]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch(`/api/admin/shelters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        ...form,
        max_persons: Number(form.max_persons),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); setCreating(false); return; }
    setForm({ slug: "", title: "", owner_email: "", max_persons: "6", description: "", booking_mode: "shelterdk", payment_mode: "after_confirmation", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25" });
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Slet "${title}"? Dette fjerner også alle bookings og tokens.`)) return;
    await fetch(`/api/admin/shelters`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ id }),
    });
    load();
  };

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="font-serif text-xl font-bold text-primary mb-2">Adgang nægtet</h1>
          <p className="text-primary/60 text-sm">
            Tilføj <code className="bg-primary/5 px-1 rounded">?secret=XXX</code> til URL&apos;en
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary mb-1">Booking admin</h1>
          <p className="text-primary/50 text-sm">Opret og administrér bookable shelters</p>
        </div>

        {/* Create form */}
        <section className="rounded-2xl border border-primary/10 bg-white p-6">
          <h2 className="font-serif text-xl font-bold text-primary mb-5">Opret nyt shelter</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Titel *
              </label>
              <input
                required value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Skovly Shelter"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Slug * <span className="text-primary/40 font-normal">(bruges i URL)</span>
              </label>
              <input
                required value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                placeholder="skovly-shelter"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Ejer-email *
              </label>
              <input
                required type="email" value={form.owner_email}
                onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))}
                placeholder="ejer@shelter.dk"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Maks personer
              </label>
              <input
                required type="number" min={1} max={50} value={form.max_persons}
                onChange={(e) => setForm((f) => ({ ...f, max_persons: e.target.value }))}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-primary mb-2">
                Bookingtype *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: "shelterdk", label: "ShelterDK", desc: "Booking foregår på shelterdk.dk/book/[slug]" },
                  { value: "iframe", label: "Iframe / embed", desc: "Ejeren embedder en iframe på sin egen hjemmeside" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                      form.booking_mode === opt.value
                        ? "border-accent bg-accent/5"
                        : "border-primary/20 hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="booking_mode"
                      value={opt.value}
                      checked={form.booking_mode === opt.value}
                      onChange={(e) => setForm((f) => ({ ...f, booking_mode: e.target.value }))}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="text-sm font-semibold text-primary">{opt.label}</div>
                      <div className="text-xs text-primary/50 mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Betalingsmodel
              </label>
              <select
                value={form.payment_mode}
                onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="after_confirmation">Betal efter accept (standard)</option>
                <option value="upfront">Betal ved booking (forudbetaling)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Pris pr. nat (kr) <span className="text-primary/40 font-normal">— tom = gratis/aftales</span>
              </label>
              <input
                type="number" min={0} value={form.shelter_price_dkk}
                onChange={(e) => setForm((f) => ({ ...f, shelter_price_dkk: e.target.value }))}
                placeholder="f.eks. 200"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Transaktionsgebyr % <span className="text-primary/40 font-normal">— standard 5%</span>
              </label>
              <input
                type="number" min={0} max={100} step={0.5} value={form.platform_fee_pct}
                onChange={(e) => setForm((f) => ({ ...f, platform_fee_pct: e.target.value }))}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Minimumsgebyr (kr) <span className="text-primary/40 font-normal">— standard 25 kr</span>
              </label>
              <input
                type="number" min={0} value={form.platform_fee_min_dkk}
                onChange={(e) => setForm((f) => ({ ...f, platform_fee_min_dkk: e.target.value }))}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-primary mb-1">
                Beskrivelse <span className="text-primary/40 font-normal">(valgfri)</span>
              </label>
              <textarea
                rows={2} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            {createError && (
              <div className="sm:col-span-2">
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit" disabled={creating}
                className="rounded-lg bg-accent text-white px-6 py-2.5 text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {creating ? "Opretter…" : "Opret shelter"}
              </button>
            </div>
          </form>
        </section>

        {/* Shelter list */}
        <section>
          <h2 className="font-serif text-xl font-bold text-primary mb-4">
            Shelters ({loading ? "…" : shelters.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-primary/5 animate-pulse" />
              ))}
            </div>
          ) : shelters.length === 0 ? (
            <p className="text-primary/50 text-sm">Ingen shelters endnu.</p>
          ) : (
            <div className="space-y-3">
              {shelters.map((s) => (
                <div key={s.id} className="rounded-xl border border-primary/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-primary">{s.title}</p>
                      <p className="text-sm text-primary/50">{s.owner_email} · maks {s.max_persons} pers.</p>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id, s.title)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 mt-0.5"
                    >
                      Slet
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary/40 w-28 shrink-0">Booking-URL</span>
                      <code className="text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded flex-1 truncate">
                        {origin}/embed/book/{s.slug}
                      </code>
                      <CopyButton value={`${origin}/embed/book/${s.slug}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary/40 w-28 shrink-0">Dashboard-link</span>
                      <code className="text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded flex-1 truncate">
                        {origin}/owner/{s.owner_token}
                      </code>
                      <CopyButton value={`${origin}/owner/${s.owner_token}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary/40 w-28 shrink-0">Embed-kode</span>
                      <CopyButton value={`<iframe src="${origin}/embed/book/${s.slug}" width="100%" height="700" frameborder="0" style="border-radius:8px;border:1px solid #e5e7eb;" title="Book ${s.title}"></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;"><a href="https://shelterdk.dk" target="_blank" rel="noopener" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a></p>`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminSheltersPage() {
  return (
    <Suspense fallback={null}>
      <AdminSheltersContent />
    </Suspense>
  );
}
