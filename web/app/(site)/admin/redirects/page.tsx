"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "shelterdk-admin-secret";

type RedirectRow = {
  id: string;
  source_path: string;
  destination_url: string;
  status_code: 301 | 302 | 307 | 308;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type DraftRow = {
  id: string;
  sourcePath: string;
  destinationUrl: string;
  statusCode: 301 | 302 | 307 | 308;
  isActive: boolean;
  note: string;
};

function toDraft(row: RedirectRow): DraftRow {
  return {
    id: row.id,
    sourcePath: row.source_path,
    destinationUrl: row.destination_url,
    statusCode: row.status_code,
    isActive: row.is_active,
    note: row.note ?? "",
  };
}

export default function AdminRedirectsPage() {
  const [secret] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : ""
  );
  const [rows, setRows] = useState<RedirectRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState({
    sourcePath: "",
    destinationUrl: "",
    statusCode: 302 as 301 | 302 | 307 | 308,
    isActive: true,
    note: "",
  });

  const query = useMemo(() => "/api/admin/redirects?limit=200", []);

  useEffect(() => {
    if (!secret) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load(isInitial = false) {
      if (isInitial) setLoading(true);
      try {
        const r = await fetch(query, { headers: { "x-admin-secret": secret } });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 401) throw new Error("401");
          throw new Error(typeof data.error === "string" ? data.error : "FETCH_FAILED");
        }
        if (cancelled) return;
        const rows = data as RedirectRow[];
        setRows(rows);
        setDrafts(Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])));
        setErrorMsg(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "401") setAuthError(true);
        else setErrorMsg(err instanceof Error ? err.message : "Kunne ikke hente redirects lige nu.");
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);
    return () => {
      cancelled = true;
    };
  }, [query, secret]);

  async function refresh() {
    const r = await fetch(query, { headers: { "x-admin-secret": secret } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "FETCH_FAILED");
    }
    const rows = data as RedirectRow[];
    setRows(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])));
  }

  async function handleCreate() {
    setCreateBusy(true);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/redirects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify(createForm),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke oprette redirect");
      await refresh();
      setCreateForm({
        sourcePath: "",
        destinationUrl: "",
        statusCode: 302,
        isActive: true,
        note: "",
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunne ikke oprette redirect");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/admin/redirects", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify(draft),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke gemme redirect");
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunne ikke gemme redirect");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setErrorMsg(null);
    try {
      const r = await fetch(`/api/admin/redirects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Kunne ikke slette redirect");
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunne ikke slette redirect");
    } finally {
      setBusyId(null);
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-primary/60 text-sm">
            Log ind via <Link href="/admin" className="text-accent underline">admin-forsiden</Link> først.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <nav className="text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Redirects</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-primary">Redirects</h1>
        <p className="text-sm text-primary/60 mt-1">
          Opret korte eller gamle URL&apos;er som fx <code>/book1</code> og send dem videre til en shelter-side.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-xl border border-primary/10 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-primary">Nyt redirect</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm text-primary/70">
            Kilde-sti
            <input
              value={createForm.sourcePath}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, sourcePath: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
              placeholder="/book1"
            />
          </label>
          <label className="text-sm text-primary/70 xl:col-span-2">
            Destination
            <input
              value={createForm.destinationUrl}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, destinationUrl: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
              placeholder="/book/dit-shelter-12345"
            />
          </label>
          <label className="text-sm text-primary/70">
            Status
            <select
              value={createForm.statusCode}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, statusCode: Number(e.target.value) as 301 | 302 | 307 | 308 }))}
              className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
            >
              <option value={301}>301</option>
              <option value={302}>302</option>
              <option value={307}>307</option>
              <option value={308}>308</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm text-primary/70">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-primary/20"
            />
            Aktiv
          </label>
        </div>
        <label className="text-sm text-primary/70 block">
          Note
          <input
            value={createForm.note}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, note: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
            placeholder="Fx kampagne-link eller gammel URL"
          />
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createBusy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {createBusy ? "Opretter…" : "Opret redirect"}
        </button>
      </section>

      {loading ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Indlæser redirects…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-white p-8 text-center text-primary/40">
          Ingen redirects endnu.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.id] ?? toDraft(row);
            return (
              <article key={row.id} className="rounded-xl border border-primary/10 bg-white p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="text-sm text-primary/70">
                    Kilde-sti
                    <input
                      value={draft.sourcePath}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, sourcePath: e.target.value } }))
                      }
                      className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-primary/70 xl:col-span-2">
                    Destination
                    <input
                      value={draft.destinationUrl}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, destinationUrl: e.target.value } }))
                      }
                      className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-primary/70">
                    Status
                    <select
                      value={draft.statusCode}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, statusCode: Number(e.target.value) as 301 | 302 | 307 | 308 },
                        }))
                      }
                      className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
                    >
                      <option value={301}>301</option>
                      <option value={302}>302</option>
                      <option value={307}>307</option>
                      <option value={308}>308</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 text-sm text-primary/70">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))
                      }
                      className="rounded border-primary/20"
                    />
                    Aktiv
                  </label>
                </div>

                <label className="text-sm text-primary/70 block">
                  Note
                  <input
                    value={draft.note}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, note: e.target.value } }))
                    }
                    className="mt-1 block w-full rounded-lg border border-primary/15 px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-primary/40">
                    Oprettet {new Date(row.created_at).toLocaleString("da-DK")} · Senest opdateret {new Date(row.updated_at).toLocaleString("da-DK")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSave(row.id)}
                      disabled={busyId === row.id}
                      className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      Gem
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.id)}
                      disabled={busyId === row.id}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Slet
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
