import { SpeakableSchema } from "@/components/seo/SpeakableSchema";

interface QuickAnswerProps {
  /** Kanonisk absolut URL til SpeakableSchema @id. */
  url: string;
  /** H2-overskrift, fx "Hurtigt svar om shelter i Aarhus Kommune". */
  heading: string;
  /** Den citérbare ét-afsnits-svar med konkrete tal. */
  answer: string;
  /** Valgfri under-linje der beskriver hvilke spørgsmål siden besvarer. */
  questionHint?: string;
  /** ISO-dato → WebPage.datePublished. */
  datePublished?: string | null;
  /** ISO-dato → WebPage.dateModified (fx last_reviewed_at). */
  dateModified?: string | null;
  /** Byline → WebPage.author (E-E-A-T). */
  authorName?: string | null;
}

/**
 * "Hurtigt svar"-answer-capsel: en kort, link-fri, faktuel boks placeret
 * tidligt på siden, med `.llm-quote`-klassen markeret til SpeakableSchema.
 * Bevidst extractable for LLM'er (ChatGPT/Perplexity/AI Overviews) uden at
 * skade SEO — det er additivt, unikt indhold pr. side med featured-snippet-
 * potentiale. Mønsteret er bevist på by-siderne; her genbrugt på øvrige
 * landingssider.
 */
export function QuickAnswer({
  url,
  heading,
  answer,
  questionHint,
  datePublished,
  dateModified,
  authorName,
}: QuickAnswerProps) {
  return (
    <>
      <SpeakableSchema
        url={url}
        selectors={[".llm-quote"]}
        datePublished={datePublished}
        dateModified={dateModified}
        authorName={authorName}
      />
      <section className="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-6">
        <h2 className="font-serif text-2xl font-bold text-primary mb-3">{heading}</h2>
        <p className="llm-quote text-primary/85 leading-relaxed">{answer}</p>
        {questionHint ? (
          <p className="mt-3 text-sm text-primary/60">{questionHint}</p>
        ) : null}
      </section>
    </>
  );
}
