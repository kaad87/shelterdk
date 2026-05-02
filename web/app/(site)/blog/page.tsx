import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts, getBlogCategories, getFeaturedPost } from "@/data/blog";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { BlogContent } from "@/components/BlogContent";
import { slugifySegment } from "@/lib/slug";

const featured = getFeaturedPost();
const PAGE_DESCRIPTION =
  "Læs tips, guider og inspiration til shelterture i Danmark. Vi skriver om pakkelister, de bedste shelterpladser, årstidens muligheder og naturovernatning.";

export const metadata: Metadata = {
  title: { absolute: "Blog – Tips og inspiration til naturovernatning | ShelterDK" },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/blog" },
  openGraph: {
    title: "Blog – Tips og inspiration til naturovernatning | ShelterDK",
    description: PAGE_DESCRIPTION,
    url: "/blog",
    images: [
      {
        url: featured.coverImage,
        width: 1200,
        height: 630,
        alt: "ShelterDK Blog",
      },
    ],
  },
};

export default function BlogPage() {
  const posts = getBlogPosts();
  const categories = getBlogCategories();
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ShelterDK Blog",
    description: PAGE_DESCRIPTION,
    url: "https://shelterdk.dk/blog",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.slice(0, 12).map((post, index) => ({
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
        items={[{ label: "Hjem", href: "/" }, { label: "Blog" }]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <section className="border-b border-primary/10 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
            Blog om shelters, friluftsliv og naturovernatning
          </h1>
          <p className="max-w-3xl text-primary/80 text-base sm:text-lg leading-relaxed">
            Her samler vi vores bedste artikler om shelterture i Danmark: regler, gratis shelters,
            sæsonråd, udstyr, inspiration og konkrete tips til at vælge den rigtige plads.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/blog/kategori/${slugifySegment(category)}`}
                className="rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-medium text-primary/75 hover:border-accent/30 hover:text-accent transition-colors"
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <BlogContent posts={posts} categories={categories} />
    </>
  );
}
