export default function TakPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="font-serif text-2xl font-bold text-primary mb-2">
          Forespørgsel sendt!
        </h1>
        <p className="text-primary/70 leading-relaxed">
          Ejeren vender tilbage hurtigst muligt. Du modtager en email-bekræftelse.
        </p>
        <p className="mt-6 text-xs text-primary/40">
          Leveret af{" "}
          <a
            href="https://shelterdk.dk"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            ShelterDK
          </a>
        </p>
      </div>
    </div>
  );
}
