export const dynamic = "force-dynamic";

export default function TakPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-green-700 mb-3">Betaling modtaget!</h1>
        <p className="text-primary/60 mb-6">
          Tak for din betaling. Du modtager en bekræftelse på e-mail inden for få minutter.
        </p>
        <a
          href="/"
          className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition"
        >
          Tilbage til forsiden
        </a>
      </div>
    </div>
  );
}
