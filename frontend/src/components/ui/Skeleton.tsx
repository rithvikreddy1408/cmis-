import type { CSSProperties } from 'react'

export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return <div className={`animate-pulse rounded-lg bg-slate-800/60 ${className}`} style={style} />
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden card">
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card p-5">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-7 w-16" />
    </div>
  )
}

// A bar-chart silhouette, not a generic spinner — matches the eventual
// content's rhythm so the layout doesn't jump once real data arrives.
const BAR_HEIGHTS = [45, 70, 55, 90, 65, 40, 80]
export function SkeletonChart({ title, height = 220 }: { title: string; height?: number }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-medium text-slate-300">{title}</h2>
      <div className="flex items-end gap-3" style={{ height }}>
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}
