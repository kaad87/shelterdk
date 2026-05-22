"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle, MessageSquare } from "lucide-react";

const CATEGORIES = [
  { value: "general", label: "Generel henvendelse" },
  { value: "fejl", label: "Fejl i data" },
  { value: "forslag", label: "Forslag til forbedring" },
  { value: "andet", label: "Andet" },
];

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Noget gik galt. Prøv igen.");
        return;
      }

      setSent(true);
    } catch {
      setError("Kunne ikke sende besked. Tjek din forbindelse og prøv igen.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h2 className="font-serif text-xl font-bold text-primary mb-2">
          Tak for din besked!
        </h2>
        <p className="text-primary/70">
          Vi har modtaget din henvendelse og vender tilbage hurtigst muligt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-primary/10 bg-white p-6 space-y-5">
        <div className="flex gap-4 items-start">
          <div className="rounded-full bg-accent/20 p-3 h-fit shrink-0">
            <MessageSquare className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-primary mb-1.5">
                  Navn
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-primary/15 px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/30 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors"
                  placeholder="Dit navn"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-primary mb-1.5">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-primary/15 px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/30 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors"
                  placeholder="din@email.dk"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-category" className="block text-sm font-medium text-primary mb-1.5">
                Hvad handler det om?
              </label>
              <select
                id="contact-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-primary/15 px-3.5 py-2.5 text-sm text-primary bg-white focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-primary mb-1.5">
                Besked
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                maxLength={5000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-primary/15 px-3.5 py-2.5 text-sm text-primary placeholder:text-primary/30 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors resize-y"
                placeholder="Skriv din besked her..."
              />
              <p className="text-xs text-primary/40 mt-1 text-right">
                {message.length}/5000
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-xl bg-accent-dark px-6 py-3 text-sm font-medium text-white hover:bg-accent-dark/90 transition-colors disabled:opacity-50"
      >
        {sending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {sending ? "Sender..." : "Send besked"}
      </button>
    </form>
  );
}
