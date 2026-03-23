// components/TurvennerClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Send } from "lucide-react";
import { TripPostCard } from "./TripPostCard";
import {
  type TripPost,
  REGIONS,
} from "@/lib/turvenner";

export function TurvennerClient() {
  const [posts, setPosts] = useState<TripPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
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
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Contact modal
  const [contactPost, setContactPost] = useState<TripPost | null>(null);
  const [contactForm, setContactForm] = useState({
    sender_name: "",
    sender_email: "",
    message: "",
    honeypot: "",
  });
  const [sending, setSending] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = region ? `?region=${encodeURIComponent(region)}` : "";
      const res = await fetch(`/api/turvenner${params}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      const res = await fetch("/api/turvenner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          trip_date: createForm.trip_date || undefined,
          spots_available: Number(createForm.spots_available),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setCreateMsg({ ok: true, text: data.message || "Opslag oprettet!" });
      setCreateForm({
        author_name: "",
        author_email: "",
        title: "",
        description: "",
        trip_date: "",
        spots_available: 1,
        region: "",
        honeypot: "",
      });
      setTimeout(() => {
        setShowCreate(false);
        setCreateMsg(null);
        fetchPosts();
      }, 1500);
    } catch {
      setCreateMsg({ ok: false, text: "Kunne ikke oprette opslag. Prøv igen." });
    } finally {
      setCreating(false);
    }
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactPost) return;
    setContactMsg(null);
    setSending(true);
    try {
      const res = await fetch(`/api/turvenner/${contactPost.slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactMsg({ ok: false, text: data.error || "Noget gik galt." });
        return;
      }
      setContactMsg({ ok: true, text: data.message || "Besked sendt!" });
      setTimeout(() => {
        setContactPost(null);
        setContactMsg(null);
        setContactForm({ sender_name: "", sender_email: "", message: "", honeypot: "" });
      }, 2000);
    } catch {
      setContactMsg({ ok: false, text: "Kunne ikke sende besked. Prøv igen." });
    } finally {
      setSending(false);
    }
  }

  async function handleReport(post: TripPost) {
    if (!confirm("Er du sikker på du vil rapportere dette opslag?")) return;
    await fetch(`/api/turvenner/${post.slug}/report`, { method: "POST" });
    fetchPosts();
  }

  const inputClass =
    "w-full rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
  const labelClass = "block text-sm font-medium text-primary/70 mb-1";

  return (
    <div>
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-primary/15 px-3 py-2 text-sm text-primary bg-white"
            aria-label="Filtrer efter region"
          >
            <option value="">Alle regioner</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-sm text-primary/40">
            {posts.length} {posts.length === 1 ? "opslag" : "opslag"}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          Opret opslag
        </button>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="text-center py-12 text-primary/30 text-sm">Indlæser opslag...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary/40 mb-2">Ingen opslag endnu</p>
          <p className="text-primary/30 text-sm">Vær den første til at oprette et opslag!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <TripPostCard
              key={post.id}
              post={post}
              onContact={setContactPost}
              onReport={handleReport}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-primary">Opret opslag</h2>
              <button onClick={() => { setShowCreate(false); setCreateMsg(null); }} className="text-primary/40 hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={createForm.honeypot}
                onChange={(e) => setCreateForm({ ...createForm, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div>
                <label className={labelClass}>Navn *</label>
                <input type="text" required value={createForm.author_name} onChange={(e) => setCreateForm({ ...createForm, author_name: e.target.value })} className={inputClass} placeholder="Dit navn" />
              </div>
              <div>
                <label className={labelClass}>Email * <span className="text-primary/30 font-normal">(vises ikke)</span></label>
                <input type="email" required value={createForm.author_email} onChange={(e) => setCreateForm({ ...createForm, author_email: e.target.value })} className={inputClass} placeholder="din@email.dk" />
              </div>
              <div>
                <label className={labelClass}>Titel *</label>
                <input type="text" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className={inputClass} placeholder="Fx: Weekendtur til Langeland" />
              </div>
              <div>
                <label className={labelClass}>Beskrivelse *</label>
                <textarea required value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className={`${inputClass} min-h-[80px]`} placeholder="Beskriv din tur og hvem du leder efter..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Turdato</label>
                  <input type="date" value={createForm.trip_date} onChange={(e) => setCreateForm({ ...createForm, trip_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ledige pladser</label>
                  <select value={createForm.spots_available} onChange={(e) => setCreateForm({ ...createForm, spots_available: Number(e.target.value) })} className={inputClass}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Region *</label>
                <select required value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })} className={inputClass}>
                  <option value="">Vælg region</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {createMsg && (
                <p className={`text-sm ${createMsg.ok ? "text-green-600" : "text-red-500"}`}>{createMsg.text}</p>
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
      )}

      {/* Contact modal */}
      {contactPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-bold text-primary">Kontakt {contactPost.author_name}</h2>
              <button onClick={() => { setContactPost(null); setContactMsg(null); }} className="text-primary/40 hover:text-primary">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-primary/50 mb-4">
              Angående: <span className="font-medium text-primary/70">{contactPost.title}</span>
            </p>
            <form onSubmit={handleContact} className="space-y-3">
              <input
                type="text"
                name="website"
                value={contactForm.honeypot}
                onChange={(e) => setContactForm({ ...contactForm, honeypot: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div>
                <label className={labelClass}>Dit navn *</label>
                <input type="text" required value={contactForm.sender_name} onChange={(e) => setContactForm({ ...contactForm, sender_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Din email *</label>
                <input type="email" required value={contactForm.sender_email} onChange={(e) => setContactForm({ ...contactForm, sender_email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Besked *</label>
                <textarea required value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} className={`${inputClass} min-h-[100px]`} placeholder="Skriv din besked her..." />
              </div>
              {contactMsg && (
                <p className={`text-sm ${contactMsg.ok ? "text-green-600" : "text-red-500"}`}>{contactMsg.text}</p>
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
      )}
    </div>
  );
}
