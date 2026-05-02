import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogCategories, getBlogPosts, type BlogCategory } from "@/data/blog";
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
  const description =
    posts[0]?.excerpt ||
    `Læs ShelterDKs blogindlæg om ${category.toLowerCase()} og få mere inspiration til din næste sheltertur.`;
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

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: category },
        ]}
      />
      <BlogContent
        posts={posts}
        categories={getBlogCategories()}
        activeCategory={category}
      />
    </>
  );
}
