import type { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Blog | ShelterDK" },
  description:
    "Tips, guider og nyheder om shelters og naturovernatning i Danmark.",
  alternates: { canonical: "https://shelterdk.dk/blog" },
  openGraph: {
    title: "Blog | ShelterDK",
    description: "Tips, guider og nyheder om shelters og naturovernatning i Danmark.",
    url: "/blog",
  },
};

const posts = [
  {
    slug: "hvordan-vælge-shelter",
    title: "Hvordan vælger man det rigtige shelter?",
    excerpt:
      "Få tips til at finde det perfekte shelter – fra beliggenhed over faciliteter til sæson.",
    date: "2024-10-15",
  },
  {
    slug: "shelter-etiquette",
    title: "Shelter-etikette i naturen",
    excerpt:
      "Husk at tage hensyn til andre og naturen når du overnatter på et shelter.",
    date: "2024-09-22",
  },
  {
    slug: "de-bedste-regioner",
    title: "De bedste regioner for shelterophold",
    excerpt:
      "En kort rundtur i Danmarks mest populære områder til naturovernatning.",
    date: "2024-08-10",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <h1 className="font-serif text-4xl font-bold text-primary mb-4">
          Blog
        </h1>
        <p className="text-primary/70 mb-12">
          Tips, guider og nyheder om shelters og naturovernatning i Danmark.
        </p>

        <ul className="space-y-8">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="group">
                <Link
                  href={`/blog/${post.slug}`}
                  className="block rounded-xl border border-primary/10 bg-white p-6 hover:border-accent/30 hover:shadow-md transition-all"
                >
                  <span className="flex items-center gap-2 text-primary/60 text-sm mb-2" suppressHydrationWarning>
                    <Calendar size={14} />
                    {new Date(post.date).toLocaleDateString("da-DK", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <h2 className="font-serif text-xl font-bold text-primary group-hover:text-accent transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-primary/80 text-sm leading-relaxed">
                    {post.excerpt}
                  </p>
                </Link>
              </article>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-primary/60 text-sm">
          Flere indlæg kommer løbende. Hold øje med siden eller{" "}
          <Link href="/kontakt" className="text-accent hover:underline">
            kontakt os
          </Link>{" "}
          hvis du har et emne du vil læse om.
        </p>
      </div>
    </div>
  );
}
