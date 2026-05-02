"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import type { BlogCategory, BlogPost } from "@/data/blog";
import { useInView } from "@/lib/useInView";
import { slugifySegment } from "@/lib/slug";

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const { ref, isInView } = useInView();
  return (
    <div
      ref={ref}
      className={isInView ? "animate-fade-in-up" : undefined}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {children}
    </div>
  );
}

function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <AnimatedCard index={index}>
      <article className="group">
        <Link
          href={`/blog/${post.slug}`}
          className="block outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-xl"
        >
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-primary/10">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <span className="absolute top-3 left-3 bg-accent text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {post.category}
            </span>
          </div>
          <div className="pt-4">
            <h3 className="font-serif text-xl font-bold text-primary group-hover:text-accent transition-colors">
              {post.title}
            </h3>
            <p className="text-primary/70 text-sm line-clamp-2 mt-2">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-3 text-primary/50 text-xs mt-3" suppressHydrationWarning>
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(post.date).toLocaleDateString("da-DK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {post.readingTime} min
              </span>
            </div>
          </div>
        </Link>
      </article>
    </AnimatedCard>
  );
}

function GuidesCTA() {
  return (
    <div className="md:col-span-2 my-4">
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-8 sm:p-10 text-center">
        <h3 className="font-serif text-2xl font-bold text-primary mb-3">
          Læs også vores guides
        </h3>
        <p className="text-primary/70 mb-6 max-w-lg mx-auto">
          Dyk ned i praktiske guides om valg af shelter, pakkelister og tips til
          en god nat i det fri.
        </p>
        <Link
          href="/guides"
          className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-full font-medium hover:bg-accent/90 transition-colors"
        >
          Se guides
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

interface BlogContentProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  activeCategory?: BlogCategory | null;
}

export function BlogContent({
  posts,
  categories,
  activeCategory = null,
}: BlogContentProps) {
  const filteredPosts = activeCategory
    ? posts.filter((post) => post.category === activeCategory)
    : posts;
  const featured = filteredPosts[0];
  const remainingPosts = filteredPosts.slice(1);
  const ctaInsertIndex = 4;

  if (!featured) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-primary/60">Ingen blogindlæg i denne kategori endnu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Link href={`/blog/${featured.slug}`} className="block group relative">
        <div className="relative h-[280px] sm:h-[340px] md:h-[420px] w-full overflow-hidden">
          <Image
            src={featured.coverImage}
            alt={featured.title}
            fill
            priority
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 md:p-16">
            <div className="max-w-3xl">
              <span className="inline-block bg-accent text-white text-xs font-medium px-3 py-1 rounded-full mb-3">
                {featured.category}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 leading-tight">
                {featured.title}
              </h2>
              <p className="text-white/80 text-sm sm:text-base max-w-xl line-clamp-2">
                {featured.excerpt}
              </p>
              <div className="flex items-center gap-3 text-white/60 text-xs sm:text-sm mt-4" suppressHydrationWarning>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(featured.date).toLocaleDateString("da-DK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {featured.readingTime} min læsetid
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-10 scrollbar-hide">
          <Link
            href="/blog"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === null
                ? "bg-primary text-white"
                : "bg-white text-primary/70 border border-primary/10 hover:border-accent/30 hover:text-primary"
            }`}
          >
            Alle
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/blog/kategori/${slugifySegment(category)}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeCategory === category
                  ? "bg-primary text-white"
                  : "bg-white text-primary/70 border border-primary/10 hover:border-accent/30 hover:text-primary"
              }`}
            >
              {category}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {remainingPosts.map((post, index) => (
            <Fragment key={post.slug}>
              {index === ctaInsertIndex && <GuidesCTA />}
              <BlogCard post={post} index={index} />
            </Fragment>
          ))}
          {remainingPosts.length > 0 && remainingPosts.length <= ctaInsertIndex && <GuidesCTA />}
        </div>

        {remainingPosts.length === 0 && (
          <p className="text-center text-primary/60 py-12">
            Ingen flere blogindlæg i denne kategori endnu.
          </p>
        )}
      </div>
    </div>
  );
}
