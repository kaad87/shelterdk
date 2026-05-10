"use client";

import { useEffect, useMemo, useState } from "react";
import { FACILITY_FIELDS, type FacilityFieldKey, type TriStateValue } from "@/lib/community";

type CommunityComment = {
  id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
};

type CommunityFacts = Partial<Record<FacilityFieldKey, TriStateValue>>;

interface CommunityApprovedSectionProps {
  slug: string;
}

function formatFactValue(value: TriStateValue): string {
  if (value === "yes") return "Ja";
  if (value === "no") return "Nej";
  return "Ved ikke";
}

export function CommunityApprovedSection({ slug }: CommunityApprovedSectionProps) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [facts, setFacts] = useState<CommunityFacts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/shelter/${slug}/comments`, { next: { revalidate: 300 } }).then((r) => r.json()),
      fetch(`/api/shelter/${slug}/community-facts`, { next: { revalidate: 300 } }).then((r) => r.json()),
    ])
      .then(([commentsRes, factsRes]) => {
        if (!active) return;
        setComments(Array.isArray(commentsRes?.comments) ? commentsRes.comments : []);
        setFacts((factsRes?.facts && typeof factsRes.facts === "object" ? factsRes.facts : {}) as CommunityFacts);
      })
      .catch(() => {
        if (!active) return;
        setComments([]);
        setFacts({});
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  const factRows = useMemo(
    () =>
      FACILITY_FIELDS.map((f) => ({ key: f.key, label: f.label, value: facts[f.key] })).filter(
        (row) => row.value != null
      ),
    [facts]
  );

  if (!loading && factRows.length === 0 && comments.length === 0) {
    return null;
  }

  return (
    <section className="mb-10 rounded-2xl border border-accent/20 bg-accent/[0.06] p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex rounded-full bg-accent text-white text-xs font-semibold px-2.5 py-1">
          Godkendt af admin
        </span>
        <h2 className="font-serif text-xl font-bold text-primary">Community-opdateringer</h2>
      </div>

      {loading ? (
        <p className="text-sm text-primary/70">Henter community-opdateringer...</p>
      ) : (
        <div className="space-y-6">
          {factRows.length > 0 && (
            <div>
              <h3 className="font-semibold text-primary mb-2">Faciliteter fra community</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {factRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-md border border-primary/10 bg-white/90 px-3 py-2 text-sm text-primary/90"
                  >
                    {row.label}: <strong>{formatFactValue(row.value as TriStateValue)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comments.length > 0 && (
            <div>
              <h3 className="font-semibold text-primary mb-2">Tips fra community</h3>
              <ul className="space-y-2">
                {comments.slice(0, 5).map((c) => (
                  <li key={c.id} className="rounded-md border border-primary/10 bg-white/90 p-3">
                    <p className="text-sm text-primary/90 whitespace-pre-line">{c.comment_text}</p>
                    <p className="mt-1 text-xs text-primary/60">
                      {c.author_name} · {new Date(c.created_at).toLocaleDateString("da-DK")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
