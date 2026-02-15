"use client";

/**
 * Placeholder når et shelter mangler billede.
 * Bruger sitets farver (primary/accent) og fylder hele billedområdet.
 */
export function ShelterPlaceholder({
  className = "",
  size = "default",
}: {
  className?: string;
  /** default = fyld container, compact = mindre til kort */
  size?: "default" | "compact";
}) {
  const isCompact = size === "compact";
  return (
    <div
      className={`absolute inset-0 flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 bg-primary/15 p-6 ${className}`}
      aria-hidden
    >
      {/* Blurred form i baggrund – bruger primary/accent */}
      <div
        className="absolute inset-0 opacity-40"
        style={{ filter: "blur(32px)" }}
      >
        <div
          className="absolute bottom-0 left-1/2 h-1/2 w-3/4 -translate-x-1/2 rounded-t-full bg-primary/30"
        />
      </div>

      {/* Ikon og tekst – primary farve */}
      <svg
        className={`relative shrink-0 text-primary/50 ${isCompact ? "h-10 w-10" : "h-14 w-14"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span
        className={`relative font-medium text-primary/70 ${
          isCompact ? "text-xs" : "text-sm"
        }`}
      >
        Ingen billeder
      </span>
    </div>
  );
}
