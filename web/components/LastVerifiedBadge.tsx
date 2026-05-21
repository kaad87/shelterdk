function formatDateDa(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface LastVerifiedBadgeProps {
  isoDate?: string | null;
  label?: string;
  className?: string;
}

export function LastVerifiedBadge({
  isoDate,
  label = "Sidst verificeret",
  className = "",
}: LastVerifiedBadgeProps) {
  if (!isoDate) return null;
  const formatted = formatDateDa(isoDate);
  if (!formatted) return null;

  return (
    <span
      data-last-verified={isoDate.slice(0, 10)}
      className={`inline-flex items-center rounded-full border border-accent/25 bg-accent/5 px-3 py-1 text-xs font-medium text-primary/70 ${className}`}
    >
      {label} {formatted}
    </span>
  );
}
