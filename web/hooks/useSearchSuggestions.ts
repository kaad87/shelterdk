"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/soeg-db";
import { getDefaultSuggestions } from "@/lib/search-helpers";

export function useSearchSuggestions(query: string, initialQuery?: string | null) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();

    if (q.length === 0) {
      if (fetchRef.current) { clearTimeout(fetchRef.current); fetchRef.current = null; }
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (q.length < 2) {
      if (fetchRef.current) { clearTimeout(fetchRef.current); fetchRef.current = null; }
      setSuggestions([]);
      setOpen(false);
      return;
    }

    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => {
      fetchRef.current = null;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      fetch(`/api/soeg/byer?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((arr: unknown) => {
          const items: SearchSuggestion[] = Array.isArray(arr)
            ? (arr as Record<string, unknown>[])
                .map((s) => ({
                  name: String(s?.name ?? ""),
                  type: (s?.type ?? "by") as SearchSuggestion["type"],
                }))
                .filter((s) => s.name.trim().length > 0)
            : [];

          setSuggestions(items);
          // Don't show dropdown if this is the already-searched value on the search page
          const alreadySearched = (initialQuery ?? "").trim() === q;
          setOpen(!alreadySearched && items.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
    };
  }, [query, initialQuery]);

  /** Call on input focus — shows defaults (recent/popular/near-me) when query is empty, or re-opens existing results. */
  const openWithDefaults = useCallback(() => {
    const q = query.trim();
    if (q.length >= 2 && suggestions.length > 0) {
      setOpen(true);
      return;
    }
    if (q.length < 2) {
      const defaults = getDefaultSuggestions() as SearchSuggestion[];
      setSuggestions(defaults);
      setOpen(defaults.length > 0);
    }
  }, [query, suggestions]);

  const close = useCallback(() => setOpen(false), []);

  return { suggestions, loading, open, setOpen, openWithDefaults, close };
}
