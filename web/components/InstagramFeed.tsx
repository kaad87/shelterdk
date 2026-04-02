"use client";

import { useEffect, useId, useState } from "react";
import { ExternalLink, Instagram } from "lucide-react";

type FeedPost = { id: string; post_url: string };

interface InstagramFeedProps {
  title?: string;
  limit?: number;
  className?: string;
}

export function InstagramFeed({
  title = "Fra Instagram",
  limit = 6,
  className = "",
}: InstagramFeedProps) {
  const headingId = useId();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/instagram/feed?limit=${limit}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { posts?: FeedPost[]; setupRequired?: boolean }) => {
        if (!cancelled) setPosts(d.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <section className={`rounded-2xl border border-primary/10 bg-white p-6 sm:p-8 ${className}`} aria-labelledby={headingId}>
        <FeedHeader id={headingId} title={title} />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mt-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-primary/[0.04] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className={`rounded-2xl border border-primary/10 bg-white p-6 sm:p-8 ${className}`} aria-labelledby={headingId}>
      <FeedHeader id={headingId} title={title} />

      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {posts.map((p) => (
          <PostCard key={p.id} url={p.post_url} />
        ))}
      </div>
    </section>
  );
}

function PostCard({ url }: { url: string }) {
  const embedUrl = url.endsWith("/") ? `${url}embed/` : `${url}/embed/`;
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-square rounded-xl overflow-hidden bg-primary/[0.03] border border-primary/8 hover:border-accent/40 hover:shadow-lg transition-all"
    >
      {/* Iframe cropped to show only the image */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <iframe
          src={embedUrl}
          className="border-0 w-[calc(100%+2px)] -ml-px"
          style={{ height: "600px", marginTop: "-54px" }}
          scrolling="no"
          loading="lazy"
          title="Instagram"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>

      {/* Placeholder while iframe loads */}
      {!iframeLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] flex items-center justify-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 flex items-center justify-center opacity-40">
            <Instagram size={16} className="text-white" />
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 z-10 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 bg-white/95 text-primary text-xs font-semibold rounded-full px-3 py-1.5 shadow-lg">
          <Instagram size={13} /> Se opslag <ExternalLink size={11} />
        </span>
      </div>
    </a>
  );
}

function FeedHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 flex items-center justify-center shadow-sm">
        <Instagram size={20} className="text-white" />
      </div>
      <div>
        <h2 id={id} className="font-serif text-xl font-bold text-primary">
          {title}
        </h2>
        <p className="text-xs text-primary/50">Udvalgte opslag fra Instagram</p>
      </div>
    </div>
  );
}
