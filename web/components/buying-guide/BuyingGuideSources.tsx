export function BuyingGuideSources({
  sources,
}: {
  sources: { title: string; url: string }[] | null;
}) {
  if (!sources || sources.length === 0) return null;
  return (
    <section className="mt-10 border-t border-primary/10 pt-6">
      <h2 className="mb-2 font-serif text-lg font-bold text-primary">
        Tests og kilder vi har gennemgået
      </h2>
      <ul className="space-y-1 text-sm">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              rel="nofollow noopener"
              target="_blank"
              className="text-accent hover:underline"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
