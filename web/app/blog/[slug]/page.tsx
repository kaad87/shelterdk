import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";

const posts: Record<
  string,
  { title: string; date: string; content: string }
> = {
  "hvordan-vælge-shelter": {
    title: "Hvordan vælger man det rigtige shelter?",
    date: "2024-10-15",
    content: `
Der er mange shelters i Danmark – fra simple bålpladser til fuldt udstyrede shelter med bænke og tag. Her er et par ting at overveje, når du vælger dit næste opholdssted i naturen.

**Beliggenhed.** Vil du helst være tæt på parkering eller vil du gå en tur først? Se på kortet og læs beskrivelsen for at få et indtryk af afstand og adgang.

**Faciliteter.** Har shelteret bord, bænke, brændeovn? Mange har kun en bålplads – tjek hvad du kan forvente under "Faciliteter" på sheltersiden.

**Sæson og vejr.** Nogle shelters er kun åbne i sæsonen. Husk telt eller regnbeskyttelse hvis vejret er usikkert – sheltertag dækker ikke altid fuldt.

**Bookbar.** Nogle shelter kan bookes på forhånd (fx via udinaturen.dk eller Book en Shelter). Hvis du vil være sikker på pladsen, vælg et bookbart shelter i højsæsonen.
    `.trim(),
  },
  "shelter-etiquette": {
    title: "Shelter-etikette i naturen",
    date: "2024-09-22",
    content: `
At overnatte i naturen er en privilegie – og det kræver hensyn. Her er nogle simple regler, så alle (og naturen) har det godt.

**Deling.** Shelter er ofte til flere. Vær åben for at dele pladsen med andre, medmindre du har booket det specifikt for dig selv.

**Ryd op.** Tag alt affald med. Lad stedet være renere end da du kom – det gør næste gæst glad.

**Brænde og bål.** Brug kun det brænde der er tilgængeligt, eller medbring dit eget. Sluk altid bål ordentligt.

**Lyd.** Naturen er stille – hold musik og høj stemme nede om aftenen.

**Respekt for dyrelivet.** Lad dyr i fred og sørg for at mad ikke tiltrækker uønsket besøg.
    `.trim(),
  },
  "de-bedste-regioner": {
    title: "De bedste regioner for shelterophold",
    date: "2024-08-10",
    content: `
Danmark har mange skønne områder til naturovernatning. Her er et kort overblik over nogle af de mest populære regioner.

**Jylland.** Store skove som Rold Skov, Himmerland og Silkeborg-området byder på masser af shelter og gode vandrestier. God adgang til parkering og korte ture.

**Sjælland.** Nord- og Sydsjælland har både kystnære og skovshelter. Gribskov og store dele af kysten tilbyder gode muligheder.

**Fyn.** Centrale skove og kyststrækninger med mange shelter – ofte med god cykelafstand.

**Øerne.** Lolland, Falster, Møn og Bornholm har deres egen karakter. Bornholm er særligt kendt for sin natur og mange shelters.

Brug søgefeltet til at filtrere på region – eller udforsk kortet for at finde dit næste favoritsted.
    `.trim(),
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) return { title: "Indlæg ikke fundet" };
  return {
    title: post.title,
    description: post.content.slice(0, 160).replace(/\n/g, " "),
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) notFound();

  const blocks = post.content
    .split(/\n\n+/)
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split("\n");
      if (lines[0].match(/^\*\*.+\*\*$/)) {
        return {
          type: "heading" as const,
          title: lines[0].replace(/\*\*/g, ""),
          body: lines.slice(1).join("\n"),
        };
      }
      return { type: "paragraph" as const, text: block };
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-primary/70 hover:text-accent text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Tilbage til blog
        </Link>

        <article>
          <span className="flex items-center gap-2 text-primary/60 text-sm mb-4" suppressHydrationWarning>
            <Calendar size={14} />
            {new Date(post.date).toLocaleDateString("da-DK", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <h1 className="font-serif text-4xl font-bold text-primary mb-8">
            {post.title}
          </h1>

          <div className="prose prose-primary max-w-none text-primary/90 leading-relaxed space-y-4">
            {blocks.map((block, i) =>
              block.type === "heading" ? (
                <div key={i}>
                  <h2 className="font-serif text-xl font-bold text-primary mt-6 mb-2">
                    {block.title}
                  </h2>
                  {block.body && (
                    <p className="whitespace-pre-line">{block.body}</p>
                  )}
                </div>
              ) : (
                <p key={i} className="whitespace-pre-line">
                  {block.text.replace(/\*\*(.+?)\*\*/g, "$1")}
                </p>
              )
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
