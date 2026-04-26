import type { Metadata } from "next";
import { getBlogPosts, getBlogCategories, getFeaturedPost } from "@/data/blog";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { BlogContent } from "@/components/BlogContent";

const featured = getFeaturedPost();

export const metadata: Metadata = {
  title: { absolute: "Blog – Tips og inspiration til naturovernatning | ShelterDK" },
  description:
    "Læs tips, guider og inspiration til shelterture i Danmark. Vi skriver om pakkelister, de bedste shelterpladser, årstidens muligheder og naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/blog" },
  openGraph: {
    title: "Blog – Tips og inspiration til naturovernatning | ShelterDK",
    description:
      "Læs tips, guider og inspiration til shelterture i Danmark. Vi skriver om pakkelister, de bedste shelterpladser, årstidens muligheder og naturovernatning.",
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

  return (
    <>
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: "Blog" }]}
      />
      <BlogContent posts={posts} categories={categories} />
    </>
  );
}
