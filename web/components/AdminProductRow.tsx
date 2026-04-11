"use client";

import Image from "next/image";
import { Copy, Star, Ban, Check } from "lucide-react";
import { useState } from "react";

export interface AdminProduct {
  id: string;
  retailer: string;
  brand: string | null;
  product_name: string;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  image_url: string;
  category_mapped: string | null;
  in_stock: boolean;
  is_blocked: boolean;
}

interface Props {
  product: AdminProduct;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function AdminProductRow({
  product,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(product.is_blocked);
  const [blocking, setBlocking] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(`::gear[${product.id}]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleBlock = async () => {
    const secret = prompt("Admin secret:");
    if (!secret) return;
    setBlocking(true);
    try {
      const res = await fetch("/api/admin/affiliate-products/block", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          id: product.id,
          blocked: !blocked,
          reason: "manual",
        }),
      });
      if (res.ok) setBlocked(!blocked);
      else alert(`Failed: ${res.status}`);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border border-primary/10 bg-white p-3 ${blocked ? "opacity-50" : ""}`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-primary/5">
        <Image
          src={product.image_url}
          alt=""
          fill
          className="object-contain"
          sizes="56px"
          unoptimized
        />
      </div>
      <div className="flex-1 min-w-0">
        {product.brand && (
          <div className="text-[11px] text-accent font-semibold">
            {product.brand}
          </div>
        )}
        <div className="truncate font-medium text-primary">
          {product.product_name}
        </div>
        <div className="text-[11px] text-primary/50">
          {product.retailer} · {product.category_mapped ?? "ukategoriseret"} ·{" "}
          {product.price} kr
          {product.discount_pct != null && ` · –${product.discount_pct}%`}
          {!product.in_stock && " · udsolgt"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={copyId}
          className="rounded border border-primary/20 px-2 py-1.5 text-xs hover:bg-primary/5"
          title="Kopi ::gear[id] til clipboard"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button
          onClick={() => onToggleFavorite(product.id)}
          className={`rounded border px-2 py-1.5 ${isFavorite ? "border-accent text-accent" : "border-primary/20 text-primary/50"}`}
          title="Favorit"
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          onClick={toggleBlock}
          disabled={blocking}
          className={`rounded border px-2 py-1.5 ${blocked ? "border-red-500 text-red-500" : "border-primary/20 text-primary/50"}`}
          title={blocked ? "Fjern blokering" : "Blokér"}
        >
          <Ban size={14} />
        </button>
      </div>
    </div>
  );
}
