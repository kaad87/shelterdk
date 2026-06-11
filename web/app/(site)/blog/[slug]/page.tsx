import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBlogPosts,
  getBlogPostBySlug,
  getBlogUpdatedAt,
  getRelatedBlogPosts,
} from "@/data/blog";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { renderContent } from "@/lib/renderContent";
import { AuthorBio } from "@/components/AuthorBio";
import { ArticleFaq } from "@/components/ArticleFaq";
import { ShelterCTA } from "@/components/ShelterCTA";
import { ShareExperience } from "@/components/ShareExperience";
import dynamic from "next/dynamic";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { slugifySegment } from "@/lib/slug";

const InstagramFeed = dynamic(
  () => import("@/components/InstagramFeed").then((m) => ({ default: m.InstagramFeed })),
  { ssr: false }
);
const NewsletterSignup = dynamic(
  () => import("@/components/NewsletterSignup"),
  { ssr: false }
);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: { absolute: "Indlæg ikke fundet" } };
  const title = `${post.title} | ShelterDK`;
  const description = post.excerpt;
  const canonicalPath = `/blog/${rawSlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonicalPath,
      publishedTime: post.date,
      modifiedTime: getBlogUpdatedAt(post),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const BASE_URL = "https://shelterdk.dk";
  const canonicalPath = `/blog/${slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    inLanguage: "da",
    headline: post.title,
    datePublished: post.date,
    dateModified: getBlogUpdatedAt(post),
    image: post.coverImage,
    articleSection: post.category,
    author: {
      "@type": "Person",
      name: "Christian",
      url: `${BASE_URL}/om-os`,
    },
    publisher: { "@type": "Organization", name: "ShelterDK", url: BASE_URL },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}${canonicalPath}`,
    },
  };

  // Render content and split for inline CTA insertion
  const contentBlocks = await renderContent(post.content);
  const midpoint = Math.floor(contentBlocks.length / 2);
  const firstHalf = contentBlocks.slice(0, midpoint);
  const secondHalf = contentBlocks.slice(midpoint);

  // Related posts — same category first, then fill from other categories
  const relatedPosts = getRelatedBlogPosts(post.slug, 3);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title },
        ]}
      />
      <div className="min-h-screen bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />

        {/* Hero image */}
        <div className="relative h-[280px] sm:h-[340px] md:h-[420px] w-full overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 md:p-16">
            <div className="max-w-3xl">
              <span className="inline-block bg-accent-dark text-white text-xs font-medium px-3 py-1 rounded-full mb-3">
                <Link
                  href={`/blog/kategori/${slugifySegment(post.category)}`}
                  className="hover:text-white/90 transition-colors"
                >
                  {post.category}
                </Link>
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl md:text-5xl font-bold text-white leading-tight">
                {post.title}
              </h1>
              <div
                className="flex items-center gap-3 text-white/60 text-sm mt-4"
                suppressHydrationWarning
              >
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {post.updatedAt ? "Opdateret " : ""}
                  {new Date(post.updatedAt ?? post.date).toLocaleDateString("da-DK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {post.readingTime} min læsetid
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary/70 hover:text-accent text-sm mb-8 transition-colors"
          >
            <ArrowLeft size={16} />
            Tilbage til blog
          </Link>

          {/* Article content — first half */}
          <article className="prose prose-primary max-w-none">
            {firstHalf}
          </article>

          {/* Inline shelter CTA */}
          <ShelterCTA variant="inline" />

          {/* Article content — second half */}
          <article className="prose prose-primary max-w-none">
            {secondHalf}
          </article>

          {/* Author bio */}
          <div className="mt-12">
            <AuthorBio />
          </div>

          {/* FAQ section */}
          {post.faq && post.faq.length > 0 && <ArticleFaq items={post.faq} />}

          <InstagramFeed title="Shelter-stemning fra Instagram" className="mt-12" />

          <NewsletterSignup variant="inline" source="blog" className="mt-12" />

          {/* Cross-links for topic cluster connectivity */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Udforsk mere</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/danmark/jylland" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelters i Jylland</Link>
              <Link href="/danmark/sjaelland" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelters på Sjælland</Link>
              <Link href="/danmark/fyn" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelters på Fyn</Link>
              <Link href="/danmark/bornholm" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelters på Bornholm</Link>
              <Link href={`/blog/kategori/${slugifySegment(post.category)}`} className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Flere indlæg om {post.category.toLowerCase()}</Link>
              <Link href="/fakta/shelters-i-danmark" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Fakta om shelters</Link>
              <Link href="/fakta/gratis-shelters" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Gratis shelters</Link>
              <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Begynderguide</Link>
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Pakkeliste</Link>
            </div>
          </section>

          {/* Share experience */}
          <ShareExperience />

          {/* Full-width shelter CTA */}
          <ShelterCTA variant="full" />

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-12 pt-10 border-t border-primary/10">
              <h2 className="font-serif text-2xl font-bold text-primary mb-6">
                Læs også
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group block rounded-xl overflow-hidden border border-primary/10 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={related.coverImage}
                        alt={related.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                      <span className="absolute top-2 left-2 bg-accent-dark text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        {related.category}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-serif text-base font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
                        {related.title}
                      </h3>
                      <p
                        className="text-primary/60 text-xs mt-2"
                        suppressHydrationWarning
                      >
                        {new Date(related.date).toLocaleDateString("da-DK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
