// components/TurvennerContactModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Send } from "lucide-react";
import type { TripPost } from "@/lib/turvenner";

interface Props {
  post: TripPost;
  onClose: () => void;
}

export function TurvennerContactModal({ post, onClose }: Props) {
  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    message: "",
    honeypot: "",
  });
  const [sending, setSending] = useState(false);
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
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = original;
    };
  }, [handleKeyDown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSending(true);
    try {
      const res = await fetch(`/api/turvenner/${post.slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setMsg({ ok: true, text: "Din besked er sendt!" });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch {
      setMsg({ ok: false, text: "Kunne ikke sende besked. Prøv igen." });
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-primary/15 px-3 py-2.5 text-base sm:text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
  const labelClass = "block text-sm font-medium text-primary/70 mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm sm:max-w-lg p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold text-primary">
            Kontakt {post.author_name}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 -mr-2 rounded-full text-primary/40 hover:text-primary hover:bg-primary/5 transition-colors touch-manipulation"
            aria-label="Luk"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-primary/50 mb-4">
          Angående:{" "}
          <span className="font-medium text-primary/70">{post.title}</span>
        </p>

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
            <label className={labelClass}>Dit navn *</label>
            <input
              type="text"
              required
              value={form.sender_name}
              onChange={(e) =>
                setForm({ ...form, sender_name: e.target.value })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Din email *</label>
            <input
              type="email"
              required
              value={form.sender_email}
              onChange={(e) =>
                setForm({ ...form, sender_email: e.target.value })
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Besked *</label>
            <textarea
              required
              maxLength={1000}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${inputClass} min-h-[100px]`}
              placeholder="Fortæl kort om dig selv og hvorfor du gerne vil med på turen..."
            />
            <p className="text-xs text-primary/30 mt-1 text-right">
              {form.message.length}/1000
            </p>
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
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {sending ? "Sender..." : "Send besked"}
          </button>
        </form>
      </div>
    </div>
  );
}
