"use client";

import { useState, useRef } from "react";
import type { BookableShelter } from "@/types/booking";

interface Props {
  shelter: BookableShelter;
  photos: string[];          // current user_image_urls from shelters table
  shelterDbId: string;       // shelters.id (= bookable_shelters.shelter_id) for ownership check
}

export function ShelterEditForm({ shelter, photos: initialPhotos, shelterDbId }: Props) {
  const [form, setForm] = useState({
    title: shelter.title ?? "",
    description: shelter.description ?? "",
    max_persons: shelter.max_persons,
  });
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/ejer/shelter/${shelter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Noget gik galt"); return; }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Noget gik galt — prøv igen");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/ejer/shelter/${shelter.id}/billeder`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload fejlede"); return; }
      setPhotos((prev) => [...prev, data.url]);
    } catch {
      setUploadError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm("Slet dette billede?")) return;
    try {
      const res = await fetch(`/api/ejer/shelter/${shelter.id}/billeder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error ?? "Sletning fejlede");
        return;
      }
      setPhotos((prev) => prev.filter((u) => u !== url));
    } catch {
      setUploadError("Sletning fejlede — prøv igen");
    }
  }

  const isOwnerPhoto = (url: string) => url.includes(`/owner/${shelterDbId}/`);

  return (
    <div>
      <div className="mb-6">
        <a href="/ejer/dashboard" className="text-sm text-primary/40 hover:text-primary transition-colors">
          ← Tilbage til dashboard
        </a>
        <h1 className="font-serif text-2xl font-bold text-primary mt-2">{shelter.title}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-5 bg-white rounded-2xl border border-primary/8 p-5 mb-6">
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-widest">Shelter-info</h2>

        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Titel *</label>
          <input
            type="text" required maxLength={100}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Beskrivelse</label>
          <textarea
            maxLength={2000} rows={5}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
          <p className="text-xs text-primary/30 mt-1">{form.description.length}/2000</p>
        </div>

        <div className="max-w-xs">
          <div>
            <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Maks. personer</label>
            <input
              type="number" min={1} max={50} required
              value={form.max_persons}
              onChange={(e) => setForm((f) => ({ ...f, max_persons: Number(e.target.value) }))}
              className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
        </div>

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">Gemt ✓</div>
        )}

        <button
          type="submit" disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-accent text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
        >
          {saving ? "Gemmer…" : "Gem ændringer"}
        </button>
      </form>

      {/* Photo gallery */}
      <div className="bg-white rounded-2xl border border-primary/8 p-5">
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-widest mb-4">Billeder</h2>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {photos.map((url) => (
              <div key={url} className="relative group aspect-video rounded-xl overflow-hidden bg-primary/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {isOwnerPhoto(url) && (
                  <button
                    onClick={() => handleDeletePhoto(url)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Slet billede"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-primary/40 mb-4">Ingen billeder endnu.</p>
        )}

        {shelter.shelter_id ? (
          <>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/15 rounded-xl p-6 cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <span className="text-2xl mb-2">{uploading ? "⏳" : "📷"}</span>
              <span className="text-sm font-medium text-primary/60">
                {uploading ? "Uploader…" : "Klik for at tilføje billede"}
              </span>
              <span className="text-xs text-primary/30 mt-1">JPEG, PNG eller WebP · maks. 5 MB</span>
            </label>
            {uploadError && (
              <p className="text-sm text-red-600 mt-2">{uploadError}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-primary/40 italic">
            Billedupload kræver at sheltet er linket til kataloget — kontakt admin.
          </p>
        )}
      </div>
    </div>
  );
}
