"use client";

import { useState } from "react";
import { Star, X, UploadCloud } from "lucide-react";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  secret: string;
}

/** Upload billeder fra computeren til Supabase Storage; viser thumbnails, hovedbillede = første. */
export function StayImageUploader({ images, onChange, secret }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | File[]) {
    setErr(null);
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch("/api/admin/nature-stays/upload", { method: "POST", headers: { "x-admin-secret": secret }, body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error || "Upload fejlede"); continue; }
        if (j.url) added.push(j.url);
      } catch { setErr("Upload fejlede — tjek forbindelsen."); }
    }
    if (added.length) onChange([...images, ...added]);
    setBusy(false);
  }

  const makeMain = (i: number) => onChange([images[i], ...images.filter((_, j) => j !== i)]);
  const remove = (i: number) => onChange(images.filter((_, j) => j !== i));

  return (
    <div>
      <label className="block text-sm font-medium text-primary/80">Billeder (upload fra computer)</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${drag ? "border-accent bg-accent/5" : "border-primary/20"}`}
      >
        <UploadCloud className="mb-1 h-6 w-6 text-primary/40" aria-hidden />
        <p className="text-primary/60">Træk billeder hertil, eller</p>
        <label className="mt-1 cursor-pointer rounded border px-3 py-1 text-primary hover:bg-primary/5">
          Vælg filer
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        </label>
        {busy && <p className="mt-2 text-primary/50">Uploader…</p>}
        {err && <p className="mt-2 text-red-600">{err}</p>}
      </div>

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={url} className={`group relative overflow-hidden rounded-lg border ${i === 0 ? "border-accent" : "border-primary/15"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">Hoved</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/40 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 ? (
                  <button type="button" aria-label="Gør til hovedbillede" className="text-white" onClick={() => makeMain(i)}><Star className="h-4 w-4" /></button>
                ) : <span />}
                <button type="button" aria-label="Fjern billede" className="text-white" onClick={() => remove(i)}><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
