"use client";

import { useState } from "react";
import type { BookableShelter } from "@/types/booking";
import type { Shelter, PhotoItem } from "@shared/types/shelter";
import { getOrderedPhotoItems } from "@shared/lib/shelter-detail";
import { PhotoGallery } from "@/components/ejer/PhotoGallery";

interface Props {
  shelter: BookableShelter;
  sharedContent: Shelter | null;
  shelterDbId: string;
}

export function ShelterEditForm({ shelter, sharedContent, shelterDbId }: Props) {
  const [form, setForm] = useState({
    title: shelter.title ?? "",
    description: shelter.description ?? "",
    max_persons: shelter.max_persons,
  });
  const [photos, setPhotos] = useState<PhotoItem[]>(
    sharedContent && shelterDbId ? getOrderedPhotoItems(sharedContent, shelterDbId) : []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoSaveMsg, setPhotoSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);

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

  async function handleUpload(file: File) {
    if (!shelter.shelter_id) return;
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
      setPhotos((prev) => [...prev, { url: data.url as string, isDeletable: true }]);
    } catch {
      setUploadError("Upload fejlede — prøv igen");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm("Slet dette billede?")) return;
    const prev = photos;
    setPhotos((p) => p.filter((item) => item.url !== url));
    try {
      const res = await fetch(`/api/ejer/shelter/${shelter.id}/billeder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error ?? "Sletning fejlede");
        setPhotos(prev);
      }
    } catch {
      setUploadError("Sletning fejlede — prøv igen");
      setPhotos(prev);
    }
  }

  async function handleSavePhotoOrder() {
    setPhotoSaving(true);
    setPhotoSaveMsg(null);
    try {
      const res = await fetch(`/api/ejer/shelter/${shelter.id}/bookinger/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_order: photos.map((p) => p.url) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoSaveMsg({ ok: false, text: data.error ?? "Noget gik galt" });
      } else {
        setPhotoSaveMsg({ ok: true, text: "Billedrækkefølge gemt" });
      }
    } catch {
      setPhotoSaveMsg({ ok: false, text: "Noget gik galt" });
    } finally {
      setPhotoSaving(false);
    }
  }

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
          <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1.5">Maks. personer</label>
          <input
            type="number" min={1} max={50} required
            value={form.max_persons}
            onChange={(e) => setForm((f) => ({ ...f, max_persons: Number(e.target.value) }))}
            className="w-full rounded-xl border border-primary/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
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
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-widest mb-1">Billeder</h2>
        <p className="text-sm text-primary/50 mb-4">
          Træk billederne for at ændre rækkefølgen. Officielle billeder kan ikke slettes.
        </p>

        {shelter.shelter_id ? (
          <>
            <PhotoGallery
              photos={photos}
              uploading={uploading}
              uploadError={uploadError}
              onReorder={setPhotos}
              onDelete={handleDeletePhoto}
              onUpload={handleUpload}
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleSavePhotoOrder}
                disabled={photoSaving}
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-[#b8923f] disabled:opacity-50 transition-colors"
              >
                {photoSaving ? "Gemmer…" : "Gem billeder"}
              </button>
              {photoSaveMsg && (
                <p className={`text-sm ${photoSaveMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {photoSaveMsg.text}
                </p>
              )}
            </div>
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
