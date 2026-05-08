"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface BookableShelter {
  id: string;
  slug: string;
  title: string;
  owner_email: string;
  owner_token: string;
  auth_user_id: string | null;
  max_persons: number;
  description: string | null;
  payment_mode: "after_confirmation" | "upfront";
  shelter_price_dkk: number | null;
  platform_fee_pct: number;
  platform_fee_min_dkk: number;
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

  // ─── Opret ejer-konto ────────────────────────────────────────────────────────
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserShelterIds, setNewUserShelterIds] = useState<Set<string>>(new Set());
  const [newUserShelterSearch, setNewUserShelterSearch] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserResult, setNewUserResult] = useState<{
    tempPassword: string;
    shelters: { id: string; title: string }[];
  } | null>(null);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  const toggleShelter = (id: string) =>
    setNewUserShelterIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setNewUserError(null);
    setNewUserResult(null);
    try {
      const res = await fetch("/api/admin/ejer-users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ email: newUserEmail, shelter_ids: [...newUserShelterIds] }),
      });
      const data = await res.json();
      if (!res.ok) { setNewUserError(data.error ?? "Noget gik galt"); return; }
      setNewUserResult({ tempPassword: data.tempPassword, shelters: data.shelters });
      setNewUserEmail("");
      setNewUserShelterIds(new Set());
      await load();
    } catch {
      setNewUserError("Noget gik galt — prøv igen");
    } finally {
      setCreatingUser(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const [form, setForm] = useState({
    slug: "", title: "", owner_email: "", max_persons: "6", description: "", booking_mode: "shelterdk" as "shelterdk" | "iframe" | "both", payment_mode: "after_confirmation" as "after_confirmation" | "upfront", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ownerEmailDrafts, setOwnerEmailDrafts] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, {
    payment_mode: "after_confirmation" | "upfront";
    shelter_price_dkk: string;
    platform_fee_pct: string;
    platform_fee_min_dkk: string;
  }>>({});
  const [rowActionState, setRowActionState] = useState<Record<string, { loading: boolean; message: string | null; ok: boolean; signupUrl?: string | null; loginUrl?: string | null }>>({});

  const origin = typeof window !== "undefined" ? window.location.origin : "https://shelterdk.dk";

  const authHeaders = { "x-admin-secret": secret };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/shelters`, { headers: authHeaders });
    if (res.status === 401) { setAuthError(true); setLoading(false); return; }
    const data = await res.json();
    const nextShelters = data.shelters ?? [];
    setShelters(nextShelters);
    setOwnerEmailDrafts(
      Object.fromEntries(
        nextShelters.map((s: BookableShelter) => [s.id, s.owner_email ?? ""])
      )
    );
    setPaymentDrafts(
      Object.fromEntries(
        nextShelters.map((s: BookableShelter) => [s.id, {
          payment_mode: s.payment_mode ?? "after_confirmation",
          shelter_price_dkk: s.shelter_price_dkk != null ? String(s.shelter_price_dkk) : "",
          platform_fee_pct: String(s.platform_fee_pct ?? 5),
          platform_fee_min_dkk: String(s.platform_fee_min_dkk ?? 25),
        }])
      )
    );
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
    setForm({ slug: "", title: "", owner_email: "", max_persons: "6", description: "", booking_mode: "shelterdk" as "shelterdk" | "iframe" | "both", payment_mode: "after_confirmation" as "after_confirmation" | "upfront", shelter_price_dkk: "", platform_fee_pct: "5", platform_fee_min_dkk: "25" });
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

  const setRowStatus = (id: string, next: { loading: boolean; message: string | null; ok: boolean; signupUrl?: string | null; loginUrl?: string | null }) => {
    setRowActionState((prev) => ({ ...prev, [id]: next }));
  };

  const handleRowAction = async (
    id: string,
    action: "update_owner_email" | "update_payment_settings" | "send_invite" | "link_existing_user" | "unlink_owner",
    extra: Record<string, unknown> = {}
  ) => {
    setRowStatus(id, { loading: true, message: null, ok: false });
    try {
      const res = await fetch(`/api/admin/shelters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowStatus(id, { loading: false, message: data.error ?? "Noget gik galt", ok: false });
        return;
      }
      const successMessage =
        action === "send_invite"
          ? "Invite sendt"
          : action === "update_payment_settings"
            ? "Betalingsindstillinger gemt"
          : action === "unlink_owner"
              ? "Konto frakoblet"
              : "Ejer-email gemt";
      setRowStatus(id, {
        loading: false,
        message: successMessage,
        ok: true,
        signupUrl: data.signupUrl ?? null,
        loginUrl: data.loginUrl ?? null,
      });
      await load();
    } catch {
      setRowStatus(id, { loading: false, message: "Noget gik galt", ok: false });
    }
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
          <p className="text-primary/35 text-xs mt-1">
            Typisk flow: sæt ejer-email, send invite og lad ejeren selv acceptere tilknytningen via signup eller login.
          </p>
        </div>

        {/* Opret ejer-konto */}
        <section className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6">
          <h2 className="font-serif text-xl font-bold text-primary mb-1">Opret ejer-konto</h2>
          <p className="text-sm text-primary/50 mb-5">
            Opretter en ny login-konto og linker de valgte shelters til den. Du modtager et midlertidigt password som du sender til ejeren.
          </p>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Email *</label>
              <input
                required type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="ejer@shelter.dk"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Shelters der tilknyttes *
                <span className="ml-2 text-xs font-normal text-primary/40">{newUserShelterIds.size} valgt</span>
              </label>
              <input
                type="text"
                value={newUserShelterSearch}
                onChange={(e) => setNewUserShelterSearch(e.target.value)}
                placeholder="Søg shelter…"
                className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-primary/15 bg-white divide-y divide-primary/8">
                {shelters
                  .filter((s) =>
                    newUserShelterSearch === "" ||
                    s.title.toLowerCase().includes(newUserShelterSearch.toLowerCase()) ||
                    s.owner_email.toLowerCase().includes(newUserShelterSearch.toLowerCase())
                  )
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/[0.03] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newUserShelterIds.has(s.id)}
                        onChange={() => toggleShelter(s.id)}
                        className="w-4 h-4 rounded accent-accent"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{s.title}</p>
                        <p className="text-xs text-primary/40 truncate">
                          {s.owner_email}
                          {s.auth_user_id && (
                            <span className="ml-1.5 text-amber-600">· allerede knyttet</span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                {loading && (
                  <p className="text-sm text-primary/40 px-4 py-3">Henter shelters…</p>
                )}
              </div>
            </div>
            {newUserError && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{newUserError}</div>
            )}
            {newUserResult && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-800">
                  ✓ Konto oprettet · {newUserResult.shelters.length} shelter{newUserResult.shelters.length !== 1 ? "s" : ""} tilknyttet
                </p>
                <div>
                  <p className="text-xs text-emerald-700 mb-1">Shelters: {newUserResult.shelters.map((s) => s.title).join(", ")}</p>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg border border-emerald-200 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary/50 mb-0.5">Midlertidigt password</p>
                    <code className="text-sm font-mono font-semibold text-primary">{newUserResult.tempPassword}</code>
                  </div>
                  <CopyButton value={newUserResult.tempPassword} />
                </div>
                <p className="text-xs text-emerald-700">Send email + password til ejeren. De kan ændre password via &ldquo;Glemt adgangskode&rdquo; på login-siden.</p>
              </div>
            )}
            <button
              type="submit" disabled={creatingUser || newUserShelterIds.size === 0}
              className="rounded-lg bg-accent text-white px-6 py-2.5 text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {creatingUser ? "Opretter konto…" : "Opret konto og kopiér password"}
            </button>
          </form>
        </section>

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
                Bookingkanaler * <span className="text-primary/40 font-normal">— vælg én eller begge</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "shelterdk" as const, label: "ShelterDK", desc: "shelterdk.dk/book/[slug] — til shelters uden egen hjemmeside" },
                  { key: "iframe" as const, label: "Iframe / embed", desc: "Ejeren embedder en iframe på sin egen hjemmeside" },
                ].map(({ key, label, desc }) => {
                  const checked = form.booking_mode === key || form.booking_mode === "both";
                  const toggle = () => setForm((f) => {
                    const cur = f.booking_mode;
                    if (key === "shelterdk") {
                      if (cur === "both") return { ...f, booking_mode: "iframe" };
                      if (cur === "iframe") return { ...f, booking_mode: "both" };
                      return f;
                    } else {
                      if (cur === "both") return { ...f, booking_mode: "shelterdk" };
                      if (cur === "shelterdk") return { ...f, booking_mode: "both" };
                      return f;
                    }
                  });
                  return (
                    <button key={key} type="button" onClick={toggle}
                      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors text-left ${checked ? "border-accent bg-accent/5" : "border-primary/20 hover:border-primary/40"}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-accent bg-accent" : "border-primary/30"}`}>
                        {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary">{label}</div>
                        <div className="text-xs text-primary/50 mt-0.5">{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Betalingsmodel
              </label>
              <select
                value={form.payment_mode}
                onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value as "after_confirmation" | "upfront" }))}
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
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-sm text-primary/50">{s.owner_email} · maks {s.max_persons} pers.</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.auth_user_id ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {s.auth_user_id ? "Knyttet til konto" : "Ikke knyttet endnu"}
                        </span>
                      </div>
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
                      <span className="text-xs text-primary/40 w-28 shrink-0">Embed-kode</span>
                      <CopyButton value={`<iframe src="${origin}/embed/book/${s.slug}" width="100%" height="700" frameborder="0" style="border-radius:8px;border:1px solid #e5e7eb;" title="Book ${s.title}"></iframe>\n<p style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px;"><a href="https://shelterdk.dk" target="_blank" rel="noopener" title="Find og book shelters i hele Danmark">Shelter booking leveret af ShelterDK</a></p>`} />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-primary/8 pt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-primary/50 mb-1">
                          Ejer-email
                        </label>
                        <input
                          type="email"
                          value={ownerEmailDrafts[s.id] ?? s.owner_email}
                          onChange={(e) =>
                            setOwnerEmailDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <button
                        onClick={() => handleRowAction(s.id, "update_owner_email", { owner_email: ownerEmailDrafts[s.id] ?? s.owner_email })}
                        disabled={rowActionState[s.id]?.loading}
                        className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        Gem email
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-primary/50 mb-1">
                          Betalingsmodel
                        </label>
                        <select
                          value={paymentDrafts[s.id]?.payment_mode ?? "after_confirmation"}
                          onChange={(e) =>
                            setPaymentDrafts((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] ?? {
                                  payment_mode: "after_confirmation",
                                  shelter_price_dkk: "",
                                  platform_fee_pct: "5",
                                  platform_fee_min_dkk: "25",
                                }),
                                payment_mode: e.target.value as "after_confirmation" | "upfront",
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="after_confirmation">Betal efter accept</option>
                          <option value="upfront">Betal med det samme</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary/50 mb-1">
                          Pris pr. nat (kr)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={paymentDrafts[s.id]?.shelter_price_dkk ?? ""}
                          onChange={(e) =>
                            setPaymentDrafts((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] ?? {
                                  payment_mode: "after_confirmation",
                                  shelter_price_dkk: "",
                                  platform_fee_pct: "5",
                                  platform_fee_min_dkk: "25",
                                }),
                                shelter_price_dkk: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary/50 mb-1">
                          Transaktionsgebyr %
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={paymentDrafts[s.id]?.platform_fee_pct ?? "5"}
                          onChange={(e) =>
                            setPaymentDrafts((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] ?? {
                                  payment_mode: "after_confirmation",
                                  shelter_price_dkk: "",
                                  platform_fee_pct: "5",
                                  platform_fee_min_dkk: "25",
                                }),
                                platform_fee_pct: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary/50 mb-1">
                          Minimumsgebyr (kr)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={paymentDrafts[s.id]?.platform_fee_min_dkk ?? "25"}
                          onChange={(e) =>
                            setPaymentDrafts((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] ?? {
                                  payment_mode: "after_confirmation",
                                  shelter_price_dkk: "",
                                  platform_fee_pct: "5",
                                  platform_fee_min_dkk: "25",
                                }),
                                platform_fee_min_dkk: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRowAction(s.id, "update_payment_settings", paymentDrafts[s.id] ?? {
                          payment_mode: "after_confirmation",
                          shelter_price_dkk: "",
                          platform_fee_pct: "5",
                          platform_fee_min_dkk: "25",
                        })}
                        disabled={rowActionState[s.id]?.loading}
                        className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        Gem betaling
                      </button>
                      <button
                        onClick={() => handleRowAction(s.id, "send_invite")}
                        disabled={rowActionState[s.id]?.loading}
                        className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                      >
                        Send invite
                      </button>
                      <button
                        onClick={() => handleRowAction(s.id, "unlink_owner")}
                        disabled={rowActionState[s.id]?.loading || !s.auth_user_id}
                        className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
                      >
                        Frakobl konto
                      </button>
                    </div>
                    {rowActionState[s.id]?.message && (
                      <div className={`text-sm rounded-lg px-3 py-2 ${rowActionState[s.id]?.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        <p>{rowActionState[s.id]?.message}</p>
                        {rowActionState[s.id]?.ok && rowActionState[s.id]?.signupUrl && (
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-primary/45">Signup-link</span>
                              <CopyButton value={rowActionState[s.id]?.signupUrl ?? ""} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-primary/45">Login-link</span>
                              <CopyButton value={rowActionState[s.id]?.loginUrl ?? ""} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
