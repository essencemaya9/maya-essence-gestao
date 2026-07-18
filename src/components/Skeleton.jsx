export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-slate-700/40 rounded-lg ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-7 w-32" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="card p-4 flex items-center justify-between gap-4">
      <div className="space-y-2 flex-1">
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-3 w-1/4" />
      </div>
      <SkeletonBlock className="h-6 w-20" />
    </div>
  )
}

export function SkeletonList({ count = 5, RowComponent = SkeletonRow }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <RowComponent key={i} />
      ))}
    </div>
  )
}
