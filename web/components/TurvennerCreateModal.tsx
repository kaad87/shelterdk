// components/TurvennerCreateModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { REGIONS } from "@/lib/turvenner";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function TurvennerCreateModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    author_name: "",
    author_email: "",
    title: "",
    description: "",
    trip_date: "",
    spots_available: 1,
    region: "" as string,
    honeypot: "",
  });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreating(true);
    try {
      const res = await fetch("/api/turvenner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          trip_date: form.trip_date || undefined,
          spots_available: Number(form.spots_available),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setMsg({ ok: true, text: data.message || "Opslag oprettet!" });
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1500);
    } catch {
      setMsg({ ok: false, text: "Kunne ikke oprette opslag. Prøv igen." });
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
  const labelClass = "block text-sm font-medium text-primary/70 mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-bold text-primary">
            Opret opslag
          </h2>
          <button
            onClick={onClose}
            className="text-primary/40 hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            value={form.honeypot}
            onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          <div>
            <label className={labelClass}>Navn *</label>
            <input
              type="text"
              required
              value={form.author_name}
              onChange={(e) =>
                setForm({ ...form, author_name: e.target.value })
              }
              className={inputClass}
              placeholder="Dit navn"
            />
          </div>

          <div>
            <label className={labelClass}>
              Email *{" "}
              <span className="text-primary/30 font-normal">(vises ikke)</span>
            </label>
            <input
              type="email"
              required
              value={form.author_email}
              onChange={(e) =>
                setForm({ ...form, author_email: e.target.value })
              }
              className={inputClass}
              placeholder="din@email.dk"
            />
          </div>

          <div>
            <label className={labelClass}>Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="Fx: Weekendtur til Langeland"
            />
          </div>

          <div>
            <label className={labelClass}>Beskrivelse *</label>
            <textarea
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className={`${inputClass} min-h-[80px]`}
              placeholder="Beskriv din tur og hvem du leder efter..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Turdato</label>
              <input
                type="date"
                value={form.trip_date}
                onChange={(e) =>
                  setForm({ ...form, trip_date: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ledige pladser</label>
              <select
                value={form.spots_available}
                onChange={(e) =>
                  setForm({
                    ...form,
                    spots_available: Number(e.target.value),
                  })
                }
                className={inputClass}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Region *</label>
            <select
              required
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className={inputClass}
            >
              <option value="">Vælg region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {msg && (
            <p
              className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {creating ? "Opretter..." : "Opret opslag"}
          </button>
        </form>
      </div>
    </div>
  );
}
