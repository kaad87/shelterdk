"use client";

interface Props {
  label?: string;
  className?: string;
}

export default function PrintButton({
  label = "Print bookingbevis",
  className = "",
}: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`inline-flex items-center justify-center rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 ${className}`.trim()}
    >
      {label}
    </button>
  );
}
