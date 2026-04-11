"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AdminProductRow, type AdminProduct } from "./AdminProductRow";

interface Props {
  initialRows: AdminProduct[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
}

const RETAILERS = ["backpackerlife", "outmore", "outdoortid"] as const;

export function AdminProducts({
  initialRows,
  currentPage,
  pageCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("affiliate-favorites");
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("affiliate-favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== (searchParams.get("q") ?? ""))
        updateParam("q", query || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = initialRows.filter((r) => {
    if (searchParams.get("onlyFavorites") === "1") return favorites.has(r.id);
    return true;
  });

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0 space-y-6 text-sm">
        <div>
          <label className="mb-2 block font-semibold text-primary">
            Forhandler
          </label>
          <select
            value={searchParams.get("retailer") ?? ""}
            onChange={(e) => updateParam("retailer", e.target.value || null)}
            className="w-full rounded border border-primary/20 px-2 py-1.5"
          >
            <option value="">Alle</option>
            {RETAILERS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-semibold text-primary">
            Min rabat %
          </label>
          <input
            type="number"
            min="0"
            max="100"
            defaultValue={searchParams.get("minDiscount") ?? ""}
            onBlur={(e) => updateParam("minDiscount", e.target.value || null)}
            className="w-full rounded border border-primary/20 px-2 py-1.5"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyInStock") === "1"}
            onChange={(e) =>
              updateParam("onlyInStock", e.target.checked ? "1" : null)
            }
          />
          <span>Kun på lager</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyBlocked") === "1"}
            onChange={(e) =>
              updateParam("onlyBlocked", e.target.checked ? "1" : null)
            }
          />
          <span>Kun blokeret</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyFavorites") === "1"}
            onChange={(e) =>
              updateParam("onlyFavorites", e.target.checked ? "1" : null)
            }
          />
          <span>Kun favoritter</span>
        </label>
      </aside>

      <div className="flex-1 min-w-0">
        <input
          type="search"
          placeholder="Søg brand eller produktnavn…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-4 w-full rounded-lg border border-primary/20 px-4 py-2"
        />
        <div className="space-y-2">
          {filtered.map((p) => (
            <AdminProductRow
              key={p.id}
              product={p}
              isFavorite={favorites.has(p.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-lg bg-primary/5 py-8 text-center text-primary/60">
              Ingen produkter matcher filtrene
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-primary/60">
            Side {currentPage} af {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1 || isPending}
              onClick={() => updateParam("page", String(currentPage - 1))}
              className="rounded border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Forrige
            </button>
            <button
              disabled={currentPage >= pageCount || isPending}
              onClick={() => updateParam("page", String(currentPage + 1))}
              className="rounded border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Næste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
