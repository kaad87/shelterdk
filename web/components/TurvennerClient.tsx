// components/TurvennerClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { TurvennerCard } from "./TurvennerCard";
import { TurvennerCreateModal } from "./TurvennerCreateModal";
import { TurvennerContactModal } from "./TurvennerContactModal";
import { type TripPost, REGIONS } from "@/lib/turvenner";

export function TurvennerClient() {
  const [posts, setPosts] = useState<TripPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [contactPost, setContactPost] = useState<TripPost | null>(null);

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

  async function handleReport(post: TripPost) {
    if (!confirm("Er du sikker på du vil rapportere dette opslag?")) return;
    await fetch(`/api/turvenner/${post.slug}/report`, { method: "POST" });
    fetchPosts();
  }

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
        <div className="text-center py-12 text-primary/30 text-sm">
          Indlæser opslag...
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          {region ? (
            <>
              <p className="text-primary/40 mb-2">
                Ingen opslag i {region} endnu. Prøv en anden region eller vær den første!
              </p>
              <button
                onClick={() => setRegion("")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Nulstil filter
              </button>
            </>
          ) : (
            <>
              <p className="text-primary/40 mb-2">Ingen opslag endnu</p>
              <p className="text-primary/30 text-sm">
                Vær den første til at oprette et!
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <TurvennerCard
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
        <TurvennerCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchPosts}
        />
      )}

      {/* Contact modal */}
      {contactPost && (
        <TurvennerContactModal
          post={contactPost}
          onClose={() => setContactPost(null)}
        />
      )}
    </div>
  );
}
