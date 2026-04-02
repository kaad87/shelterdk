"use client";

import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { useState, FormEvent } from "react";

interface Props {
  variant?: "inline" | "compact";
  source?: string;
  className?: string;
}

export default function NewsletterSignup({
  variant = "inline",
  source = "unknown",
  className = "",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Noget gik galt. Prøv igen.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Kunne ikke oprette forbindelse. Prøv igen.");
    }
  }

  if (variant === "compact") {
    return (
      <div
        className={`rounded-2xl border border-primary/10 bg-primary/[0.02] p-5 ${className}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-accent" />
          <h3 className="font-serif text-sm font-bold text-primary">
            Shelter-nyt i din indbakke
          </h3>
        </div>

        {status === "success" ? (
          <div className="flex items-center gap-2 text-green-700 text-sm py-1">
            <CheckCircle className="h-4 w-4" />
            <span>Tak! Du hører fra os.</span>
          </div>
        ) : (
          <>
            <p className="text-primary/60 text-xs leading-relaxed mb-3">
              Tips til shelterture og nye pladser — max 1-2 gange om måneden.
            </p>
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                type="email"
                required
                placeholder="Din email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-xl bg-accent text-white font-semibold px-4 py-2.5 text-sm hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Tilmeld"
                )}
              </button>
            </form>
            {status === "error" && (
              <p className="text-red-600 text-xs mt-2">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-primary/10 bg-primary/[0.02] p-6 sm:p-8 ${className}`}
    >
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 mb-4">
          <Mail className="h-5 w-5 text-accent" />
        </div>

        <h3 className="font-serif text-xl sm:text-2xl font-bold text-primary mb-2">
          Shelter-nyt i din indbakke
        </h3>
        <p className="text-primary/60 text-sm sm:text-base leading-relaxed mb-5">
          Modtag tips til shelterture, nye pladser og sæsonguides — max 1-2
          gange om måneden.
        </p>

        {status === "success" ? (
          <div className="flex items-center justify-center gap-2 text-green-700 py-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Tak! Du hører fra os.</span>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="Din email-adresse"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-xl bg-accent text-white font-semibold px-5 py-3 text-sm hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Tilmeld nyhedsbrev"
                )}
              </button>
            </form>
            {status === "error" && (
              <p className="text-red-600 text-sm mt-3">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
