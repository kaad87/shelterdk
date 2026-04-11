import Image from "next/image";
import Link from "next/link";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { getProducts, type AffiliateProduct } from "@/lib/affiliate-products";
import { GearCardView } from "@/components/GearCard";

// ---- Gear id extraction ----

const GEAR_BLOCK_RE = /^::(gear|gear-group)\[([^\]]+)\]$/;
const GEAR_INLINE_RE = /::gear-inline\[([^\]]+)\]/g;

export function extractGearIds(content: string): string[] {
  const ids = new Set<string>();
  // Block-level: each paragraph may be a gear directive
  for (const block of content.split(/\n\n+/)) {
    const m = block.trim().match(GEAR_BLOCK_RE);
    if (m) {
      for (const raw of m[2].split(",")) {
        const id = raw.trim();
        if (id) ids.add(id);
      }
    }
  }
  // Inline: scan the whole content for ::gear-inline[id]
  GEAR_INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GEAR_INLINE_RE.exec(content))) {
    const id = match[1].trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

// ---- Inline renderer (bold, links, gear-inline) ----

/** Render inline bold: **text** → <strong> */
function renderBold(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={`b-${m.index}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Render inline links [label](url), bold **text**, and ::gear-inline[id] pills */
function renderInline(
  text: string,
  products: Map<string, AffiliateProduct>
): (string | JSX.Element)[] {
  const segments: (string | JSX.Element)[] = [];

  // First pass: split on ::gear-inline[id], replacing with GearCardView pills
  const gearParts: (string | JSX.Element)[] = [];
  let lastIdx = 0;
  GEAR_INLINE_RE.lastIndex = 0;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = GEAR_INLINE_RE.exec(text))) {
    if (gMatch.index > lastIdx) {
      gearParts.push(text.slice(lastIdx, gMatch.index));
    }
    const id = gMatch[1].trim();
    const product = products.get(id);
    if (product && !product.is_blocked) {
      gearParts.push(
        <GearCardView
          key={`gp-${gMatch.index}`}
          product={product}
          variant="pill"
        />
      );
    }
    lastIdx = gMatch.index + gMatch[0].length;
  }
  if (lastIdx < text.length) gearParts.push(text.slice(lastIdx));

  // Second pass: for string parts, handle links + bold
  for (const part of gearParts) {
    if (typeof part !== "string") {
      segments.push(part);
      continue;
    }
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let li = 0;
    let lm: RegExpExecArray | null;
    while ((lm = linkRegex.exec(part))) {
      if (lm.index > li) segments.push(...renderBold(part.slice(li, lm.index)));
      const label = lm[1];
      const href = lm[2];
      const isExternal = href.startsWith("http");
      segments.push(
        isExternal ? (
          <a
            key={`l-${segments.length}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-medium hover:underline inline-flex items-center gap-1"
          >
            {label}
            <ExternalLinkIcon size={12} className="inline" />
          </a>
        ) : (
          <Link
            key={`l-${segments.length}`}
            href={href}
            className="text-accent font-medium hover:underline"
          >
            {label}
          </Link>
        )
      );
      li = lm.index + lm[0].length;
    }
    if (li < part.length) segments.push(...renderBold(part.slice(li)));
  }
  return segments;
}

// ---- Block renderer ----

/** Render markdown-like content string to JSX blocks */
export async function renderContent(
  content: string
): Promise<JSX.Element[]> {
  const ids = extractGearIds(content);
  const products =
    ids.length > 0
      ? await getProducts(ids)
      : new Map<string, AffiliateProduct>();

  const blocks = content
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    // Gear block: ::gear[id] or ::gear-group[a,b,c]
    const gm = block.match(GEAR_BLOCK_RE);
    if (gm) {
      const kind = gm[1];
      const rawIds = gm[2]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (kind === "gear") {
        const product = products.get(rawIds[0]);
        if (!product || product.is_blocked) {
          return (
            <span key={index} style={{ display: "none" }} data-gear-missing={rawIds[0]} />
          );
        }
        return (
          <GearCardView key={index} product={product} variant="editorial" />
        );
      }
      // gear-group
      const found = rawIds
        .map((id) => products.get(id))
        .filter((p): p is AffiliateProduct => !!p && !p.is_blocked);
      if (found.length === 0) {
        return (
          <span key={index} style={{ display: "none" }} data-gear-group-empty />
        );
      }
      return (
        <div
          key={index}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6"
        >
          {found.map((p) => (
            <GearCardView key={p.id} product={p} variant="editorial" />
          ))}
        </div>
      );
    }

    // Image: ![alt](url)
    const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      return (
        <figure key={index} className="my-8">
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
            <Image
              src={src}
              alt={alt || ""}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 720px"
              unoptimized
            />
          </div>
          {alt && (
            <figcaption className="text-center text-sm text-primary/50 mt-2 italic">
              {alt}
            </figcaption>
          )}
        </figure>
      );
    }

    // H2: ## Heading
    if (block.startsWith("## ")) {
      return (
        <h2
          key={index}
          className="mt-10 mb-3 font-serif text-2xl font-bold text-primary"
        >
          {block.slice(3).trim()}
        </h2>
      );
    }

    // H3: ### Heading
    if (block.startsWith("### ")) {
      return (
        <h3
          key={index}
          className="mt-6 mb-2 font-serif text-lg font-bold text-primary"
        >
          {block.slice(4).trim()}
        </h3>
      );
    }

    // Bullet list: lines starting with - or *
    if (block.startsWith("- ") || block.startsWith("* ")) {
      const items = block
        .split(/\n/)
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);
      return (
        <ul key={index} className="list-disc pl-6 space-y-2 my-4">
          {items.map((item, i) => (
            <li key={i} className="text-primary/90 leading-relaxed">
              {renderInline(item, products)}
            </li>
          ))}
        </ul>
      );
    }

    // Regular paragraph
    return (
      <p key={index} className="my-3 text-primary/90 leading-relaxed">
        {renderInline(block, products)}
      </p>
    );
  });
}
