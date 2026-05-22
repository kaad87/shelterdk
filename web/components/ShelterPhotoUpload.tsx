"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

interface ShelterPhotoUploadProps {
  shelterId: string;
  slug: string;
  /** Kompakt visning inde i "Ingen billede"-boksen */
  variant?: "default" | "inline";
}

export function ShelterPhotoUpload({
  shelterId,
  slug,
  variant = "default",
}: ShelterPhotoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const fileInputId = variant === "inline" ? "shelter-photo-file-inline" : "shelter-photo-file";
  const emailInputId = variant === "inline" ? "shelter-photo-email-inline" : "shelter-photo-email";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setMessage("");

    const formData = new FormData();
    formData.set("file", file);
    if (email.trim()) formData.set("email", email.trim());

    try {
      const res = await fetch(`/api/shelter/${slug}/upload-photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Noget gik galt.");
        return;
      }
      setStatus("success");
      setMessage(data.message || "Tak! Billedet er sendt til godkendelse.");
      setFile(null);
      setEmail("");
      const input = document.getElementById(fileInputId) as HTMLInputElement;
      if (input) input.value = "";
    } catch {
      setStatus("error");
      setMessage("Kunne ikke sende. Tjek forbindelsen og prøv igen.");
    }
  }

  if (variant === "inline") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-white/90">
        <p className="text-sm text-center">Upload et billede – det vises efter godkendelse.</p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 w-full max-w-xs">
          <div className="flex flex-col items-center gap-1 w-full">
            <input
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={status === "uploading"}
            />
            <label
              htmlFor={fileInputId}
              className="inline-flex cursor-pointer rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 disabled:pointer-events-none disabled:opacity-50"
            >
              Vælg billede
            </label>
            <span className="text-xs text-white/70">
              {file ? file.name : "Ingen fil valgt"}
            </span>
          </div>
          <input
            id={emailInputId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail (valgfri)"
            className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            disabled={status === "uploading"}
          />
          <button
            type="submit"
            disabled={!file || status === "uploading"}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {status === "uploading" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            {status === "uploading" ? "Sender…" : "Send"}
          </button>
        </form>
        {message && (
          <p
            className={`text-sm text-center ${status === "success" ? "text-green-300" : "text-red-200"}`}
            role="alert"
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-primary/10 bg-white/50 p-5 mb-8">
      <h2 className="font-serif text-xl font-bold text-primary mb-3">
        Har du et billede af shelteret?
      </h2>
      <p className="text-primary/80 text-sm mb-4">
        Upload et billede (JPEG, PNG eller WebP, max 5 MB). Det gennemgås og vises herefter på siden.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={fileInputId} className="block text-sm font-medium text-primary mb-1">
            Vælg billede
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={status === "uploading"}
          />
          <label
            htmlFor={fileInputId}
            className="inline-flex cursor-pointer rounded-lg border border-primary/20 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:pointer-events-none disabled:opacity-50"
          >
            Vælg billede
          </label>
          <span className="ml-3 text-sm text-primary/70">
            {file ? file.name : "Ingen fil valgt"}
          </span>
        </div>
        <div>
          <label htmlFor={emailInputId} className="block text-sm font-medium text-primary mb-1">
            E-mail (valgfri – til evt. opfølgning)
          </label>
          <input
            id={emailInputId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.dk"
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-primary placeholder:text-primary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            disabled={status === "uploading"}
          />
        </div>
        <button
          type="submit"
          disabled={!file || status === "uploading"}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {status === "uploading" ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Sender…
            </>
          ) : (
            <>
              <Upload size={18} />
              Send til godkendelse
            </>
          )}
        </button>
      </form>
      {message && (
        <p
          className={`mt-4 text-sm ${status === "success" ? "text-green-700" : "text-red-600"}`}
          role="alert"
        >
          {message}
        </p>
      )}
    </section>
  );
}
