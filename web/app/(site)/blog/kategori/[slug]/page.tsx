import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBlogCategories,
  getBlogCategoryDescription,
  getBlogPosts,
  type BlogCategory,
} from "@/data/blog";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { BlogContent } from "@/components/BlogContent";
import { slugifySegment } from "@/lib/slug";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return getBlogCategories().find((category) => slugifySegment(category) === slug);
}

export function generateStaticParams() {
  return getBlogCategories().map((category) => ({
    slug: slugifySegment(category),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) {
    return { title: { absolute: "Kategori ikke fundet | ShelterDK" } };
  }

  const posts = getBlogPosts().filter((post) => post.category === category);
  const description = getBlogCategoryDescription(category);
  const canonicalPath = `/blog/kategori/${slug}`;

  return {
    title: { absolute: `Blog om ${category} | ShelterDK` },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonicalPath}` },
    openGraph: {
      title: `Blog om ${category} | ShelterDK`,
      description,
      url: canonicalPath,
      images: posts[0]
        ? [{ url: posts[0].coverImage, width: 1200, height: 630, alt: posts[0].title }]
        : undefined,
    },
  };
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const posts = getBlogPosts().filter((post) => post.category === category);
  const description = getBlogCategoryDescription(category);
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `ShelterDK Blog: ${category}`,
    description,
    url: `https://shelterdk.dk/blog/kategori/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://shelterdk.dk/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: category },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <p className="text-sm text-primary/50 uppercase tracking-[0.18em] mb-3">
            Blogkategori
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
            Blog om {category.toLowerCase()}
          </h1>
          <p className="max-w-3xl text-primary/80 text-base sm:text-lg leading-relaxed">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/blog" className="text-accent hover:underline">
              Se alle blogindlæg
            </Link>
            <Link href="/guides" className="text-accent hover:underline">
              Udforsk også guides
            </Link>
          </div>
        </div>
      </section>
      <BlogContent
        posts={posts}
        categories={getBlogCategories()}
        activeCategory={category}
      />
    </>
  );
}
