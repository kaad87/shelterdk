export default function SoegLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb skeleton */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-4 w-20 bg-primary/10 rounded animate-pulse" />
          <div className="h-4 w-4 bg-primary/5 rounded animate-pulse" />
          <div className="h-4 w-28 bg-primary/10 rounded animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="h-9 w-56 bg-primary/10 rounded animate-pulse mb-2" />
        <div className="h-5 w-72 bg-primary/5 rounded animate-pulse mb-8" />

        {/* Filter bar skeleton */}
        <div className="h-14 bg-primary/5 rounded-xl animate-pulse mb-8" />

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-primary/5 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="hidden lg:block h-[600px] bg-primary/5 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
