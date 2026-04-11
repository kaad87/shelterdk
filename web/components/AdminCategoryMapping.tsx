"use client";

import { useState } from "react";

interface Row {
  retailer: string;
  category_raw: string;
  category_mapped: string | null;
  whitelisted: boolean;
}

export function AdminCategoryMapping({ rows }: { rows: Row[] }) {
  const [local, setLocal] = useState(rows);
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (row: Row) => {
    const secret = prompt("Admin secret:");
    if (!secret) return;
    const key = `${row.retailer}::${row.category_raw}`;
    setSaving(key);
    try {
      const res = await fetch(
        "/api/admin/affiliate-products/category-mapping",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-admin-secret": secret,
          },
          body: JSON.stringify(row),
        }
      );
      if (!res.ok) alert(`Failed: ${res.status}`);
    } finally {
      setSaving(null);
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setLocal((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-primary/10 text-left text-primary/60">
          <th className="py-2 pr-4">Retailer</th>
          <th className="pr-4">Raw</th>
          <th className="pr-4">Mapped</th>
          <th className="pr-4">Whitelist</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {local.map((row, i) => {
          const key = `${row.retailer}::${row.category_raw}`;
          const isUnknown = row.category_mapped == null;
          return (
            <tr
              key={key}
              className={`border-b border-primary/5 ${isUnknown ? "bg-yellow-50/50" : ""}`}
            >
              <td className="py-2 pr-4 align-top text-primary/70">
                {row.retailer}
              </td>
              <td className="pr-4 align-top text-primary/90">
                {row.category_raw}
              </td>
              <td className="pr-4 align-top">
                <input
                  type="text"
                  value={row.category_mapped ?? ""}
                  onChange={(e) =>
                    updateRow(i, { category_mapped: e.target.value })
                  }
                  placeholder="slug…"
                  className="w-32 rounded border border-primary/20 px-2 py-1"
                />
              </td>
              <td className="pr-4 align-top">
                <input
                  type="checkbox"
                  checked={row.whitelisted}
                  onChange={(e) =>
                    updateRow(i, { whitelisted: e.target.checked })
                  }
                />
              </td>
              <td className="pr-4 align-top">
                <button
                  onClick={() => save(row)}
                  disabled={saving === key}
                  className="rounded border border-primary/20 px-3 py-1 text-xs hover:bg-primary/5"
                >
                  {saving === key ? "…" : "Gem"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
