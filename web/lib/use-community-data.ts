"use client";

import { useEffect, useMemo, useState } from "react";
import { FACILITY_FIELDS, type FacilityFieldKey, type TriStateValue } from "@/lib/community";

export type CommunityComment = {
  id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
};

export type CommunityFacts = Partial<Record<FacilityFieldKey, TriStateValue>>;

export interface CommunityData {
  comments: CommunityComment[];
  facts: CommunityFacts;
  factRows: { key: FacilityFieldKey; label: string; value: TriStateValue }[];
  loading: boolean;
}

/**
 * Hook that fetches community-approved data (comments + facility facts) for a shelter.
 * Shared between the facilities section and tips section to avoid duplicate fetches.
 */
export function useCommunityData(slug: string): CommunityData {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [facts, setFacts] = useState<CommunityFacts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/shelter/${slug}/comments`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/shelter/${slug}/community-facts`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([commentsRes, factsRes]) => {
        if (!active) return;
        setComments(Array.isArray(commentsRes?.comments) ? commentsRes.comments : []);
        setFacts(
          (factsRes?.facts && typeof factsRes.facts === "object" ? factsRes.facts : {}) as CommunityFacts
        );
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

  const factRows = useMemo(() => {
    const rows: { key: FacilityFieldKey; label: string; value: TriStateValue }[] = [];
    for (const f of FACILITY_FIELDS) {
      const v = facts[f.key];
      if (v != null) rows.push({ key: f.key, label: f.label, value: v });
    }
    return rows;
  }, [facts]);

  return { comments, facts, factRows, loading };
}
