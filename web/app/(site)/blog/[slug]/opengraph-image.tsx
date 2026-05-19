import { getBlogPostBySlug } from "@/data/blog";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  return createEditorialOgImage({
    eyebrow: "ShelterDK Blog",
    title: post?.title ?? "Blogindlæg om shelterture",
    subtitle:
      post?.excerpt ??
      "Tips, inspiration og praktiske råd til bedre shelterture og naturovernatning i Danmark.",
    tag: post?.category ?? "Blog",
  });
}
