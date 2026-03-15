import Image from "next/image";
import Link from "next/link";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";

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

/** Render inline links [label](url) + bold **text** */
function renderInline(text: string): (string | JSX.Element)[] {
  const segments: (string | JSX.Element)[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text))) {
    if (match.index > lastIndex) {
      segments.push(...renderBold(text.slice(lastIndex, match.index)));
    }

    const label = match[1];
    const href = match[2];
    const isExternal = href.startsWith("http");

    if (isExternal) {
      segments.push(
        <a
          key={`l-${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent font-medium hover:underline inline-flex items-center gap-1"
        >
          {label}
          <ExternalLinkIcon size={12} className="inline" />
        </a>
      );
    } else {
      segments.push(
        <Link
          key={`l-${match.index}`}
          href={href}
          className="text-accent font-medium hover:underline"
        >
          {label}
        </Link>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...renderBold(text.slice(lastIndex)));
  }

  return segments;
}

/** Render markdown-like content string to JSX blocks */
export function renderContent(content: string): JSX.Element[] {
  const blocks = content
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
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
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    }

    // Regular paragraph
    return (
      <p key={index} className="my-3 text-primary/90 leading-relaxed">
        {renderInline(block)}
      </p>
    );
  });
}
