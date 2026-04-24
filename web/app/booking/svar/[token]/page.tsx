import Link from "next/link";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const messages: Record<string, { emoji: string; title: string; body: string }> = {
  confirmed: {
    emoji: "✓",
    title: "Booking bekræftet",
    body: "Du har bekræftet bookingen. Gæsten modtager en bekræftelsesemail.",
  },
  rejected: {
    emoji: "✗",
    title: "Booking afvist",
    body: "Du har afvist bookingen. Gæsten er notificeret.",
  },
  already_used: {
    emoji: "ℹ️",
    title: "Allerede behandlet",
    body: "Denne booking er allerede behandlet.",
  },
  expired: {
    emoji: "⏱",
    title: "Link udløbet",
    body: "Dette link er udløbet (7 dage). Gå til dit dashboard for at behandle bookingen.",
  },
  conflict: {
    emoji: "⚠️",
    title: "Dato-konflikt",
    body: "En anden bekræftet booking overlapper disse datoer. Gå til dit dashboard og afvis den ene.",
  },
  already_resolved: {
    emoji: "ℹ️",
    title: "Allerede behandlet",
    body: "Denne booking er allerede bekræftet eller afvist.",
  },
  not_found: {
    emoji: "✗",
    title: "Link ikke fundet",
    body: "Dette link er ugyldigt eller er allerede blevet brugt.",
  },
};

export default async function BookingSvarPage({ searchParams }: Props) {
  const { status = "not_found" } = await searchParams;
  const msg = messages[status] ?? messages.not_found;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm bg-white rounded-2xl border border-primary/10 shadow-sm p-8">
        <div className="text-5xl mb-4">{msg.emoji}</div>
        <h1 className="font-serif text-2xl font-bold text-primary mb-3">{msg.title}</h1>
        <p className="text-primary/70 leading-relaxed mb-6">{msg.body}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
}
