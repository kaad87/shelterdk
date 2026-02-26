import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuides, getGuideBySlug } from "@/data/guides";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const guides = getGuides();
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: { absolute: "Guide ikke fundet" } };
  const canonicalPath = `/guides/${guide.slug}`;
  return {
    title: { absolute: `${guide.title} | ShelterDK` },
    description: guide.excerpt,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title: `${guide.title} | ShelterDK`,
      description: guide.excerpt,
      url: canonicalPath,
      images: guide.coverImage
        ? [{ url: guide.coverImage, width: 1200, height: 630, alt: guide.title }]
        : undefined,
    },
  };
}

/** Konverter **tekst** og [link](url) til <strong> og <a>. */
function renderInline(text: string) {
  const segments: (string | JSX.Element)[] = [];

  // Først: split på links [label](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text))) {
    if (match.index > lastIndex) {
      segments.push(...renderBold(text.slice(lastIndex, match.index)));
    }
    const label = match[1];
    const href = match[2];
    segments.push(
      <Link
        key={`${href}-${segments.length}`}
        href={href}
        className="text-accent font-medium hover:underline"
      >
        {label}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...renderBold(text.slice(lastIndex)));
  }

  return segments;
}

function renderBold(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = boldRegex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={`${m[1]}-${parts.length}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderGuideContent(content: string) {
  const blocks = content
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith("## ")) {
      const title = block.slice(3).trim();
      return (
        <h2 key={index} className="mt-6 font-serif text-xl font-bold text-primary">
          {title}
        </h2>
      );
    }
    if (block.startsWith("### ")) {
      const title = block.slice(4).trim();
      return (
        <h3 key={index} className="mt-4 font-serif text-lg font-bold text-primary">
          {title}
        </h3>
      );
    }
    if (block.startsWith("- ") || block.startsWith("* ")) {
      const items = block.split(/\n/).map((line) => line.replace(/^[-*]\s+/, "").trim());
      return (
        <ul key={index} className="list-disc pl-6 space-y-1 my-3">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="my-3 text-primary/90 leading-relaxed">
        {renderInline(block)}
      </p>
    );
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const canonicalPath = `/guides/${guide.slug}`;
  const breadcrumbItems = [
    { label: "Hjem", href: "/" },
    { label: "Guides", href: "/guides" },
    { label: guide.title },
  ];

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema items={breadcrumbItems} />
      <header className="relative w-full h-[260px] sm:h-[320px] md:h-[380px] bg-primary text-white overflow-hidden">
        {guide.coverImage && (
          <Image
            src={guide.coverImage}
            alt=""
            fill
            className="object-cover opacity-40"
            sizes="100vw"
            priority
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
        <div className="relative h-full flex items-end">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-10">
            <nav className="mb-3 text-sm text-white/80" aria-label="Brødkrummesti">
              <ol className="flex flex-wrap items-center gap-1 list-none p-0 m-0">
                <li>
                  <Link href="/" className="hover:text-accent transition-colors">
                    Hjem
                  </Link>
                </li>
                <li aria-hidden className="mx-1 text-white/60">
                  /
                </li>
                <li>
                  <Link href="/guides" className="hover:text-accent transition-colors">
                    Guides
                  </Link>
                </li>
                <li aria-hidden className="mx-1 text-white/60">
                  /
                </li>
                <li className="text-white font-semibold truncate max-w-[220px] sm:max-w-none">
                  {guide.title}
                </li>
              </ol>
            </nav>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
              {guide.title}
            </h1>
            <p className="mt-3 text-white/90 max-w-2xl text-sm sm:text-base">
              {guide.excerpt}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <article className="prose prose-primary max-w-none">
          {renderGuideContent(guide.content)}
        </article>

        <section className="mt-10 border-t border-primary/10 pt-6 text-sm text-primary/70">
          <p>
            Flere artikler finder du på{" "}
            <Link href="/guides" className="text-accent font-medium hover:underline">
              oversigten over guides
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
