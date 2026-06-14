"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "shelterdk-admin-secret";

interface Guide {
  id?: number;
  slug: string;
  title: string;
  intro: string | null;
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  faq: unknown;
  sources: unknown;
  author: string | null;
  parent_slug: string | null;
  status: string;
  last_reviewed_at: string | null;
}

interface StayLite { id: number; name: string; region: string | null; status: string }
interface Entry {
  id: number;
  nature_stay_id: number;
  rank: number;
  award_label: string | null;
  best_for: string | null;
  editorial_note: string | null;
  stay?: { id: number; name: string; image_url: string | null; region: string | null; price_from: number | null; status: string } | null;
}

const EMPTY: Guide = {
  slug: "", title: "", intro: "", body_md: "", seo_title: "", seo_description: "",
  faq: [], sources: [], author: "ShelterDK Redaktionen", parent_slug: null, status: "draft", last_reviewed_at: null,
};

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function toJson(v: unknown): string { try { return JSON.stringify(v ?? [], null, 0); } catch { return "[]"; } }

export function AdminStayGuides() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [form, setForm] = useState<Guide>(EMPTY);
  const [faqText, setFaqText] = useState("[]");
  const [sourcesText, setSourcesText] = useState("[]");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allStays, setAllStays] = useState<StayLite[]>([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (s) setSecret(s);
  }, []);

  const authFetch = useCallback(
    (url: string, opts: RequestInit = {}) =>
      fetch(url, { ...opts, headers: { "Content-Type": "application/json", "x-admin-secret": secret, ...(opts.headers ?? {}) } }),
    [secret]
  );

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([authFetch("/api/admin/stay-guides"), authFetch("/api/admin/nature-stays")]);
    if (g.ok) setGuides((await g.json()).guides ?? []);
    else setMsg("Kunne ikke hente guider (tjek secret).");
    if (s.ok) setAllStays((await s.json()).stays ?? []);
  }, [authFetch]);

  useEffect(() => { if (secret) load(); }, [secret, load]);

  const loadEntries = useCallback(async (guideId: number) => {
    const r = await authFetch(`/api/admin/stay-guides/entries?guide_id=${guideId}`);
    if (r.ok) setEntries((await r.json()).entries ?? []);
  }, [authFetch]);

  function edit(g: Guide) {
    setForm({ ...g });
    setFaqText(toJson(g.faq));
    setSourcesText(toJson(g.sources));
    setMsg(null);
    if (typeof g.id === "number") loadEntries(g.id); else setEntries([]);
  }
  function reset() { setForm(EMPTY); setFaqText("[]"); setSourcesText("[]"); setEntries([]); setMsg(null); }

  async function save() {
    let faq: unknown, sources: unknown;
    try { faq = JSON.parse(faqText); sources = JSON.parse(sourcesText); }
    catch { setMsg("FAQ/kilder er ikke gyldig JSON."); return; }
    const slug = form.slug.trim() || slugify(form.title);
    const payload = { ...form, slug, faq, sources };
    const r = await authFetch("/api/admin/stay-guides", { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Fejl ved gem."); return; }
    setMsg("Gemt ✓");
    if (j.guide) edit(j.guide);
    load();
  }

  async function remove() {
    if (typeof form.id !== "number") return;
    if (!confirm(`Slet guide "${form.title}"?`)) return;
    await authFetch("/api/admin/stay-guides", { method: "DELETE", body: JSON.stringify({ id: form.id }) });
    reset();
    load();
  }

  async function addEntry() {
    if (typeof form.id !== "number" || !pick) return;
    await authFetch("/api/admin/stay-guides/entries", {
      method: "POST",
      body: JSON.stringify({ guide_id: form.id, nature_stay_id: Number(pick), rank: entries.length }),
    });
    setPick("");
    loadEntries(form.id);
  }
  async function patchEntry(id: number, patch: Partial<Entry>) {
    await authFetch("/api/admin/stay-guides/entries", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
    if (typeof form.id === "number") loadEntries(form.id);
  }
  async function removeEntry(id: number) {
    await authFetch("/api/admin/stay-guides/entries", { method: "DELETE", body: JSON.stringify({ id }) });
    if (typeof form.id === "number") loadEntries(form.id);
  }

  if (!secret) {
    return (
      <div className="max-w-sm">
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Admin secret" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="mt-2 rounded bg-primary px-4 py-2 text-white" onClick={() => { window.localStorage.setItem(STORAGE_KEY, input); setSecret(input); }}>Log ind</button>
      </div>
    );
  }

  const set = (k: keyof Guide) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const added = new Set(entries.map((e) => e.nature_stay_id));

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-primary">Guider ({guides.length})</h2>
          <button className="rounded border px-3 py-1 text-sm" onClick={reset}>+ Ny</button>
        </div>
        <ul className="space-y-1 text-sm">
          {guides.map((g) => (
            <li key={g.id}>
              <button className={`w-full rounded px-2 py-1 text-left hover:bg-primary/5 ${form.id === g.id ? "bg-primary/10" : ""}`} onClick={() => edit(g)}>
                <span className={g.status === "published" ? "text-green-700" : "text-primary/50"}>●</span> {g.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {msg && <p className="rounded bg-primary/5 px-3 py-2 text-sm">{msg}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Titel<input className="w-full rounded border px-2 py-1" value={form.title} onChange={set("title")} /></label>
          <label className="text-sm">Slug (auto)<input className="w-full rounded border px-2 py-1" value={form.slug} placeholder={slugify(form.title)} onChange={set("slug")} /></label>
          <label className="text-sm">Forfatter<input className="w-full rounded border px-2 py-1" value={form.author ?? ""} onChange={set("author")} /></label>
          <label className="text-sm">Status<select className="w-full rounded border px-2 py-1" value={form.status} onChange={set("status")}><option value="draft">draft</option><option value="published">published</option></select></label>
          <label className="text-sm">SEO-titel<input className="w-full rounded border px-2 py-1" value={form.seo_title ?? ""} onChange={set("seo_title")} /></label>
          <label className="text-sm">Parent-slug<input className="w-full rounded border px-2 py-1" value={form.parent_slug ?? ""} onChange={set("parent_slug")} /></label>
        </div>
        <label className="block text-sm">SEO-beskrivelse<input className="w-full rounded border px-2 py-1" value={form.seo_description ?? ""} onChange={set("seo_description")} /></label>
        <label className="block text-sm">Intro<textarea className="w-full rounded border px-2 py-1" rows={2} value={form.intro ?? ""} onChange={set("intro")} /></label>
        <label className="block text-sm">Brødtekst (markdown)<textarea className="w-full rounded border px-2 py-1" rows={6} value={form.body_md ?? ""} onChange={set("body_md")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">FAQ (JSON)<textarea className="w-full rounded border px-2 py-1 font-mono text-xs" rows={3} value={faqText} onChange={(e) => setFaqText(e.target.value)} /></label>
          <label className="text-sm">Kilder (JSON)<textarea className="w-full rounded border px-2 py-1 font-mono text-xs" rows={3} value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} /></label>
        </div>
        <div className="flex gap-2">
          <button className="rounded bg-primary px-4 py-2 text-white" onClick={save}>Gem</button>
          {typeof form.id === "number" && <button className="rounded border border-red-300 px-4 py-2 text-red-700" onClick={remove}>Slet</button>}
        </div>

        {typeof form.id === "number" && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 font-semibold text-primary">Steder i guiden ({entries.length})</h3>
            <div className="mb-3 flex gap-2">
              <select className="flex-1 rounded border px-2 py-1 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Vælg sted at tilføje…</option>
                {allStays.filter((s) => !added.has(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.region ?? "?"}{s.status !== "published" ? " · draft" : ""})</option>
                ))}
              </select>
              <button className="rounded border px-3 py-1 text-sm" onClick={addEntry} disabled={!pick}>Tilføj</button>
            </div>
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.stay?.name ?? `#${e.nature_stay_id}`}{e.stay && e.stay.status !== "published" && <span className="ml-1 text-amber-600">(draft)</span>}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-14 rounded border px-1 py-0.5" defaultValue={e.rank} onBlur={(ev) => patchEntry(e.id, { rank: Number(ev.target.value) })} title="rang" />
                      <button className="text-red-700" onClick={() => removeEntry(e.id)}>Fjern</button>
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input className="rounded border px-1 py-0.5" placeholder="Award (fx Bedst i test)" defaultValue={e.award_label ?? ""} onBlur={(ev) => patchEntry(e.id, { award_label: ev.target.value })} />
                    <input className="rounded border px-1 py-0.5" placeholder="Bedst til" defaultValue={e.best_for ?? ""} onBlur={(ev) => patchEntry(e.id, { best_for: ev.target.value })} />
                  </div>
                  <textarea className="mt-1 w-full rounded border px-1 py-0.5" rows={2} placeholder="Redaktionel note" defaultValue={e.editorial_note ?? ""} onBlur={(ev) => patchEntry(e.id, { editorial_note: ev.target.value })} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
