"use client";

import { useCallback, useEffect, useState } from "react";
import { StayLocationPicker } from "@/components/naturophold/StayLocationPicker";
import { StayImageUploader } from "@/components/naturophold/StayImageUploader";

const STORAGE_KEY = "shelterdk-admin-secret";

const TYPES = ["glamping_telt", "naturhytte", "dome", "traehus", "tiny_house", "luksus_shelter", "andet"];
const LINK_SOURCES = ["direkte", "booking_com", "andet_netvaerk"];

interface Stay {
  id?: number;
  slug: string;
  name: string;
  operator_name: string | null;
  type: string;
  region: string | null;
  kommune: string | null;
  place: string | null;
  location: string | null;
  short_description: string | null;
  body_md: string | null;
  image_url: string | null;
  image_urls: string[];
  image_permission: string | null;
  price_from: number | null;
  capacity: number | null;
  rating: number | null;
  booking_url: string | null;
  link_source: string;
  featured: boolean;
  sort_boost: number;
  status: string;
}

const EMPTY: Stay = {
  slug: "", name: "", operator_name: "", type: "glamping_telt", region: "", kommune: "", place: "",
  location: null, short_description: "", body_md: "", image_url: "", image_urls: [], image_permission: "",
  price_from: null, capacity: null, rating: null, booking_url: "", link_source: "direkte",
  featured: false, sort_boost: 0, status: "draft",
};

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function toPointWkt(lng: number, lat: number): string {
  return `POINT(${lng} ${lat})`;
}
function parseLatLng(loc: string | null): { lat: string; lng: string } {
  const m = loc?.match(/^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  return m ? { lng: m[1], lat: m[2] } : { lat: "", lng: "" };
}

export function AdminNatureStays() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [stays, setStays] = useState<Stay[]>([]);
  const [form, setForm] = useState<Stay>(EMPTY);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [images, setImages] = useState<string[]>([]);
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
    const r = await authFetch("/api/admin/nature-stays");
    if (r.ok) setStays((await r.json()).stays ?? []);
    else setMsg("Kunne ikke hente steder (tjek secret).");
  }, [authFetch]);

  useEffect(() => {
    if (secret) load();
  }, [secret, load]);

  function edit(s: Stay) {
    setForm({ ...s });
    const { lat, lng } = parseLatLng(s.location);
    setLat(lat); setLng(lng);
    setImages(s.image_urls?.length ? s.image_urls : (s.image_url ? [s.image_url] : []));
    setMsg(null);
  }
  function reset() { setForm(EMPTY); setLat(""); setLng(""); setImages([]); setMsg(null); }

  async function save() {
    const slug = form.slug.trim() || slugify(form.name);
    const haveCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat.trim() !== "" && lng.trim() !== "";
    const location = haveCoords ? toPointWkt(Number(lng), Number(lat)) : (form.location && /^POINT\(/i.test(form.location) ? form.location : null);
    // Number-inputs giver strings; tom streng → null, ellers Number (undgår
    // "invalid input syntax for type integer" mod heltals-/numeric-kolonner).
    const num = (v: unknown): number | null => (v === "" || v == null ? null : Number(v));
    const payload = {
      ...form,
      slug,
      image_url: images[0] ?? null,
      image_urls: images,
      location,
      price_from: num(form.price_from),
      capacity: num(form.capacity),
      rating: num(form.rating),
      sort_boost: num(form.sort_boost) ?? 0,
    };
    const r = await authFetch("/api/admin/nature-stays", { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Fejl ved gem."); return; }
    setMsg("Gemt ✓");
    reset();
    load();
  }

  async function remove() {
    if (typeof form.id !== "number") return;
    if (!confirm(`Slet "${form.name}"?`)) return;
    await authFetch("/api/admin/nature-stays", { method: "DELETE", body: JSON.stringify({ id: form.id }) });
    reset();
    load();
  }

  if (!secret) {
    return (
      <div className="max-w-sm">
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Admin secret" value={input}
          onChange={(e) => setInput(e.target.value)} />
        <button className="mt-2 rounded bg-primary px-4 py-2 text-white"
          onClick={() => { window.localStorage.setItem(STORAGE_KEY, input); setSecret(input); }}>
          Log ind
        </button>
      </div>
    );
  }

  const set = (k: keyof Stay) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-primary">Steder ({stays.length})</h2>
          <button className="rounded border px-3 py-1 text-sm" onClick={reset}>+ Nyt</button>
        </div>
        <ul className="space-y-1 text-sm">
          {stays.map((s) => (
            <li key={s.id}>
              <button className={`w-full rounded px-2 py-1 text-left hover:bg-primary/5 ${form.id === s.id ? "bg-primary/10" : ""}`}
                onClick={() => edit(s)}>
                <span className={s.status === "published" ? "text-green-700" : "text-primary/50"}>●</span>{" "}
                {s.name} <span className="text-primary/40">· {s.region ?? "?"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {msg && <p className="rounded bg-primary/5 px-3 py-2 text-sm">{msg}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Navn<input className="w-full rounded border px-2 py-1" value={form.name} onChange={set("name")} /></label>
          <label className="text-sm">Slug (auto)<input className="w-full rounded border px-2 py-1" value={form.slug} placeholder={slugify(form.name)} onChange={set("slug")} /></label>
          <label className="text-sm">Operatør<input className="w-full rounded border px-2 py-1" value={form.operator_name ?? ""} onChange={set("operator_name")} /></label>
          <label className="text-sm">Type<select className="w-full rounded border px-2 py-1" value={form.type} onChange={set("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm">Region<input className="w-full rounded border px-2 py-1" value={form.region ?? ""} onChange={set("region")} /></label>
          <label className="text-sm">Kommune<input className="w-full rounded border px-2 py-1" value={form.kommune ?? ""} onChange={set("kommune")} /></label>
          <label className="text-sm">Sted/by<input className="w-full rounded border px-2 py-1" value={form.place ?? ""} onChange={set("place")} /></label>
          <label className="text-sm">Pris fra (kr/nat)<input type="number" className="w-full rounded border px-2 py-1" value={form.price_from ?? ""} onChange={set("price_from")} /></label>
          <label className="text-sm">Kapacitet<input type="number" className="w-full rounded border px-2 py-1" value={form.capacity ?? ""} onChange={set("capacity")} /></label>
          <label className="text-sm">Rating<input type="number" step="0.1" className="w-full rounded border px-2 py-1" value={form.rating ?? ""} onChange={set("rating")} /></label>
        </div>

        <div className="rounded-lg border border-primary/10 p-3">
          <StayLocationPicker
            lat={lat}
            lng={lng}
            onChange={(la, ln, meta) => {
              setLat(la);
              setLng(ln);
              if (meta?.place && !form.place?.trim()) setForm((f) => ({ ...f, place: meta.place! }));
            }}
          />
        </div>
        <label className="block text-sm">Kort beskrivelse<textarea className="w-full rounded border px-2 py-1" rows={2} value={form.short_description ?? ""} onChange={set("short_description")} /></label>
        <label className="block text-sm">Brødtekst (markdown)<textarea className="w-full rounded border px-2 py-1" rows={5} value={form.body_md ?? ""} onChange={set("body_md")} /></label>
        <StayImageUploader images={images} onChange={setImages} secret={secret} />
        <label className="block text-sm">Billedtilladelse (påkrævet for publicering)<input className="w-full rounded border px-2 py-1" placeholder="fx: Ejer ok pr. mail 2026-06-14" value={form.image_permission ?? ""} onChange={set("image_permission")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Booking-URL<input className="w-full rounded border px-2 py-1" value={form.booking_url ?? ""} onChange={set("booking_url")} /></label>
          <label className="text-sm">Link-kilde<select className="w-full rounded border px-2 py-1" value={form.link_source} onChange={set("link_source")}>{LINK_SOURCES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm">Sort-boost<input type="number" className="w-full rounded border px-2 py-1" value={form.sort_boost} onChange={set("sort_boost")} /></label>
          <label className="text-sm">Status<select className="w-full rounded border px-2 py-1" value={form.status} onChange={set("status")}><option value="draft">draft</option><option value="published">published</option></select></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Fremhævet</label>
        <div className="flex gap-2">
          <button className="rounded bg-primary px-4 py-2 text-white" onClick={save}>Gem</button>
          {typeof form.id === "number" && <button className="rounded border border-red-300 px-4 py-2 text-red-700" onClick={remove}>Slet</button>}
        </div>
      </div>
    </div>
  );
}
