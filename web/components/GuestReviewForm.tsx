"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/** Stjerne + valgfri kommentar — poster til /api/anmeld/[guestToken]. */
export function GuestReviewForm({
  guestToken,
  shelterTitle,
}: {
  guestToken: string;
  shelterTitle: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Vælg antal stjerner først");
      return;
    }
    setState("sending");
    try {
      const res = await fetch(`/api/anmeld/${guestToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Noget gik galt — prøv igen");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Noget gik galt — prøv igen");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-serif text-xl font-bold text-primary mb-1">Tak for din anmeldelse!</p>
        <p className="text-sm text-primary/70">
          Den vises nu på shelterets side og hjælper andre gæster med at vælge.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-primary/70">
        Hvordan var dit ophold på <strong className="text-primary">{shelterTitle}</strong>?
      </p>
      <div className="mb-5 flex items-center gap-1" role="radiogroup" aria-label="Antal stjerner">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} stjerne${n > 1 ? "r" : ""}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
          >
            <Star
              size={30}
              className={
                n <= (hover || rating)
                  ? "fill-accent text-accent"
                  : "text-primary/25"
              }
            />
          </button>
        ))}
      </div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/60">
        Fortæl om din oplevelse <span className="font-normal normal-case">(valgfrit)</span>
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="Hvordan var pladsen, faciliteterne og omgivelserne?"
        className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/35"
      />
      {error && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-4 w-full rounded-xl bg-accent-dark py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark/90 disabled:opacity-50"
      >
        {state === "sending" ? "Sender…" : "Send anmeldelse"}
      </button>
      <p className="mt-3 text-center text-xs text-primary/45">
        Vises offentligt med dit fornavn — kun gæster med en booking kan anmelde.
      </p>
    </form>
  );
}
