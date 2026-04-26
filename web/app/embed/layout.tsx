export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-0 p-0 w-full overflow-y-auto flex flex-col min-h-screen">
      <div className="flex-1">{children}</div>

      {/* Branded footer — visible to users, drives traffic to shelterdk.dk */}
      <footer className="border-t border-primary/8 bg-white mt-8 py-3 px-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <a
            href="https://shelterdk.dk"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 group"
            title="Find og book shelters i hele Danmark"
          >
            <span className="font-serif text-sm font-bold text-primary group-hover:text-accent transition-colors">
              ShelterDK
            </span>
            <span className="text-xs text-primary/35 group-hover:text-primary/55 transition-colors">
              — Danmarks shelterguide
            </span>
          </a>
          <a
            href="https://shelterdk.dk/soeg?bookbar=1"
            target="_blank"
            rel="noopener"
            className="text-xs text-accent hover:text-accent/80 transition-colors font-medium flex items-center gap-1"
            title="Find bookbare shelters i Danmark på ShelterDK"
          >
            Find flere bookbare shelters →
          </a>
        </div>
      </footer>
    </div>
  );
}
