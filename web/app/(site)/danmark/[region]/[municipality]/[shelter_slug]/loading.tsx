export default function ShelterDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex items-center gap-2">
          <div className="h-4 w-12 bg-primary/10 rounded animate-pulse" />
          <div className="h-4 w-3 bg-primary/5 rounded animate-pulse" />
          <div className="h-4 w-20 bg-primary/10 rounded animate-pulse" />
          <div className="h-4 w-3 bg-primary/5 rounded animate-pulse" />
          <div className="h-4 w-24 bg-primary/10 rounded animate-pulse" />
        </div>

        {/* Hero image skeleton */}
        <div className="aspect-[16/9] lg:aspect-[2/1] w-full bg-primary/5 rounded-2xl animate-pulse mb-8" />

        {/* Title + meta skeleton */}
        <div className="h-10 w-3/4 bg-primary/10 rounded animate-pulse mb-3" />
        <div className="flex gap-3 mb-6">
          <div className="h-5 w-24 bg-primary/5 rounded animate-pulse" />
          <div className="h-5 w-20 bg-primary/5 rounded animate-pulse" />
          <div className="h-5 w-16 bg-primary/5 rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-4 w-full bg-primary/5 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-primary/5 rounded animate-pulse" />
            <div className="h-4 w-4/6 bg-primary/5 rounded animate-pulse" />
            <div className="h-4 w-full bg-primary/5 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-primary/5 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-primary/5 rounded-xl animate-pulse" />
            <div className="h-32 bg-primary/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
