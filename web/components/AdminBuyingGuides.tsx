"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "shelterdk-admin-secret";

interface Guide {
  id: string;
  slug: string;
  title: string;
  category: string;
  intro: string | null;
  body_md: string | null;
  sources: unknown;
  faq: unknown;
  seo_title: string | null;
  seo_description: string | null;
  hero_image_url: string | null;
  status: "draft" | "published";
  last_reviewed_at: string | null;
}

interface ProductLite {
  id: string;
  product_name: string;
  brand: string | null;
  retailer: string;
  price: number;
  in_stock: boolean;
  is_blocked?: boolean;
  category_mapped?: string | null;
  specs: unknown;
}

interface Entry {
  id: string;
  rank: number;
  award_label: string | null;
  editorial_note: string | null;
  pros: string[];
  cons: string[];
  score: number | null;
  best_for: string | null;
  affiliate_product_id: string;
  product: ProductLite | null;
}

const EMPTY_GUIDE: Partial<Guide> = { status: "draft", category: "sovepose", title: "", slug: "" };

export function AdminBuyingGuides() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [form, setForm] = useState<Partial<Guide>>(EMPTY_GUIDE);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const authFetch = useCallback(
    (url: string, opts: RequestInit = {}) =>
      fetch(url, {
        ...opts,
        headers: { "Content-Type": "application/json", "x-admin-secret": secret, ...(opts.headers ?? {}) },
      }),
    [secret]
  );

  const loadGuides = useCallback(async () => {
    const r = await authFetch("/api/admin/buying-guides");
    if (r.ok) setGuides((await r.json()).guides ?? []);
    else setMsg("Kunne ikke hente guider (tjek secret).");
  }, [authFetch]);

  useEffect(() => {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s) setSecret(s);
  }, []);
  useEffect(() => {
    if (secret) loadGuides();
  }, [secret, loadGuides]);

  const loadEntries = useCallback(
    async (guideId: string) => {
      const r = await authFetch(`/api/admin/buying-guides/entries?guide_id=${guideId}`);
      if (r.ok) setEntries((await r.json()).entries ?? []);
    },
    [authFetch]
  );

  function selectGuide(g: Guide) {
    setForm({
      ...g,
      sources: g.sources ?? [],
      faq: g.faq ?? [],
    });
    setMsg(null);
    loadEntries(g.id);
  }

  function newGuide() {
    setForm({ ...EMPTY_GUIDE });
    setEntries([]);
    setMsg(null);
  }

  async function saveGuide() {
    const payload = {
      ...form,
      sources: parseJson(form.sources, []),
      faq: parseJson(form.faq, []),
    };
    const r = await authFetch("/api/admin/buying-guides", { method: "POST", body: JSON.stringify(payload) });
    const data = await r.json();
    if (r.ok) {
      setMsg("Gemt ✓");
      setForm(data.guide);
      await loadGuides();
      if (data.guide?.id) loadEntries(data.guide.id);
    } else setMsg("Fejl: " + (data.error ?? "ukendt"));
  }

  async function deleteGuide() {
    if (!form.id || !confirm("Slet guide?")) return;
    await authFetch("/api/admin/buying-guides", { method: "DELETE", body: JSON.stringify({ id: form.id }) });
    newGuide();
    loadGuides();
  }

  async function runSearch() {
    const r = await authFetch(
      `/api/admin/affiliate-products/search?q=${encodeURIComponent(search)}&category=${encodeURIComponent(form.category ?? "")}`
    );
    if (r.ok) setResults((await r.json()).products ?? []);
  }

  async function addEntry(p: ProductLite) {
    if (!form.id) {
      setMsg("Gem guiden først.");
      return;
    }
    await authFetch("/api/admin/buying-guides/entries", {
      method: "POST",
      body: JSON.stringify({ guide_id: form.id, affiliate_product_id: p.id, rank: entries.length }),
    });
    loadEntries(form.id);
  }

  async function saveEntry(e: Entry) {
    await authFetch("/api/admin/buying-guides/entries", {
      method: "POST",
      body: JSON.stringify({
        guide_id: form.id,
        affiliate_product_id: e.affiliate_product_id,
        rank: e.rank,
        award_label: e.award_label,
        editorial_note: e.editorial_note,
        pros: e.pros,
        cons: e.cons,
        score: e.score,
        best_for: e.best_for,
      }),
    });
    if (form.id) loadEntries(form.id);
  }

  async function removeEntry(id: string) {
    await authFetch("/api/admin/buying-guides/entries", { method: "DELETE", body: JSON.stringify({ id }) });
    if (form.id) loadEntries(form.id);
  }

  async function saveSpecs(productId: string, specsJson: string) {
    const specs = parseJson(specsJson, null);
    const r = await authFetch("/api/admin/affiliate-products/specs", {
      method: "POST",
      body: JSON.stringify({ id: productId, specs }),
    });
    setMsg(r.ok ? "Specs gemt ✓" : "Specs-fejl");
    if (form.id) loadEntries(form.id);
  }

  // ---- Secret gate ----
  if (!secret) {
    return (
      <div className="max-w-sm">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Admin secret"
          className="w-full rounded-lg border border-primary/15 px-3 py-2"
        />
        <button
          onClick={() => {
            sessionStorage.setItem(STORAGE_KEY, input);
            setSecret(input);
          }}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Log ind
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px,1fr]">
      {/* Guide-liste */}
      <aside className="space-y-2">
        <button onClick={newGuide} className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
          + Ny guide
        </button>
        {guides.map((g) => (
          <button
            key={g.id}
            onClick={() => selectGuide(g)}
            className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
              form.id === g.id ? "border-accent bg-accent/5" : "border-primary/10"
            }`}
          >
            <span className="font-medium text-primary">{g.title || g.slug}</span>
            <span className="ml-1 text-xs text-primary/50">{g.status}</span>
          </button>
        ))}
      </aside>

      {/* Editor */}
      <div className="space-y-4">
        {msg && <p className="text-sm text-accent">{msg}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Slug" value={form.slug ?? ""} onChange={(v) => setForm({ ...form, slug: v })} />
          <Field label="Kategori" value={form.category ?? ""} onChange={(v) => setForm({ ...form, category: v })} />
          <Field label="Titel" value={form.title ?? ""} onChange={(v) => setForm({ ...form, title: v })} full />
          <Field label="SEO-titel" value={form.seo_title ?? ""} onChange={(v) => setForm({ ...form, seo_title: v })} />
          <Field label="Hero-billede URL" value={form.hero_image_url ?? ""} onChange={(v) => setForm({ ...form, hero_image_url: v })} />
          <Area label="Ingress (intro)" value={form.intro ?? ""} onChange={(v) => setForm({ ...form, intro: v })} />
          <Area label="SEO-beskrivelse" value={form.seo_description ?? ""} onChange={(v) => setForm({ ...form, seo_description: v })} />
          <Area label="Brødtekst (body_md, markdown — ::gear[id] virker)" value={form.body_md ?? ""} onChange={(v) => setForm({ ...form, body_md: v })} full rows={8} />
          <Area label='Kilder JSON [{"title","url"}]' value={toJson(form.sources)} onChange={(v) => setForm({ ...form, sources: v })} />
          <Area label='FAQ JSON [{"q","a"}]' value={toJson(form.faq)} onChange={(v) => setForm({ ...form, faq: v })} />
          <div>
            <label className="text-xs font-medium text-primary/60">Status</label>
            <select
              value={form.status ?? "draft"}
              onChange={(e) => setForm({ ...form, status: e.target.value as "draft" | "published" })}
              className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </div>
          <Field
            label="Sidst opdateret (ISO, fx 2026-06-06)"
            value={form.last_reviewed_at ?? ""}
            onChange={(v) => setForm({ ...form, last_reviewed_at: v })}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={saveGuide} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Gem guide
          </button>
          {form.id && (
            <button onClick={deleteGuide} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600">
              Slet
            </button>
          )}
        </div>

        {/* Entries */}
        {form.id && (
          <section className="mt-6 border-t border-primary/10 pt-4">
            <h3 className="mb-2 font-semibold text-primary">Produkter i guiden ({entries.length})</h3>
            <div className="space-y-3">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} onSave={saveEntry} onRemove={removeEntry} onSaveSpecs={saveSpecs} />
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-primary/[0.03] p-3">
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Søg produkter (kategori: ${form.category})`}
                  className="flex-1 rounded-lg border border-primary/15 px-3 py-2 text-sm"
                />
                <button onClick={runSearch} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">
                  Søg
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {results.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>
                      {p.product_name} <span className="text-primary/40">· {p.retailer} · {p.price} kr</span>
                    </span>
                    <button onClick={() => addEntry(p)} className="text-accent hover:underline">
                      + tilføj
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onSave,
  onRemove,
  onSaveSpecs,
}: {
  entry: Entry;
  onSave: (e: Entry) => void;
  onRemove: (id: string) => void;
  onSaveSpecs: (productId: string, specsJson: string) => void;
}) {
  const [e, setE] = useState<Entry>(entry);
  const [specsJson, setSpecsJson] = useState(toJson(entry.product?.specs));
  useEffect(() => setE(entry), [entry]);

  return (
    <div className="rounded-lg border border-primary/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-primary">{entry.product?.product_name ?? entry.affiliate_product_id}</span>
        <span className="text-xs text-primary/50">{entry.product?.in_stock ? "" : "UDSOLGT · "}{entry.product?.retailer}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Rank" value={String(e.rank)} onChange={(v) => setE({ ...e, rank: parseInt(v || "0", 10) })} />
        <Field label="Award" value={e.award_label ?? ""} onChange={(v) => setE({ ...e, award_label: v })} />
        <Field
          label="Score (0-10)"
          value={e.score == null ? "" : String(e.score)}
          onChange={(v) => setE({ ...e, score: v.trim() === "" ? null : parseFloat(v.replace(",", ".")) })}
        />
        <Field label="Bedst til" value={e.best_for ?? ""} onChange={(v) => setE({ ...e, best_for: v })} />
      </div>
      <Area label="Derfor (note)" value={e.editorial_note ?? ""} onChange={(v) => setE({ ...e, editorial_note: v })} full />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Area label="Fordele (én pr. linje)" value={(e.pros ?? []).join("\n")} onChange={(v) => setE({ ...e, pros: splitLines(v) })} />
        <Area label="Ulemper (én pr. linje)" value={(e.cons ?? []).join("\n")} onChange={(v) => setE({ ...e, cons: splitLines(v) })} />
      </div>
      <Area label="Specs JSON (fx {&quot;komfort_temp&quot;:-2,&quot;vaegt_g&quot;:950})" value={specsJson} onChange={setSpecsJson} full />
      <div className="mt-2 flex gap-2">
        <button onClick={() => onSave(e)} className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white">
          Gem entry
        </button>
        <button onClick={() => onSaveSpecs(entry.affiliate_product_id, specsJson)} className="rounded bg-primary px-3 py-1.5 text-xs text-white">
          Gem specs
        </button>
        <button onClick={() => onRemove(entry.id)} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600">
          Fjern
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-xs font-medium text-primary/60">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm" />
    </div>
  );
}

function Area({ label, value, onChange, full, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; rows?: number }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-xs font-medium text-primary/60">{label}</label>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm font-mono" />
    </div>
  );
}

// ---- helpers ----
function splitLines(v: string): string[] {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}
function toJson(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}
function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  if (!v.trim()) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
