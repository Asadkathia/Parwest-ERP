import { cn } from "@/lib/utils"

export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn("h-4 animate-pulse rounded bg-slate-100", className)} />
}

export function SkeletonCard() {
  return (
    <div className="ui-card p-5 space-y-3">
      <SkeletonRow className="w-1/3" />
      <SkeletonRow className="w-full" />
      <SkeletonRow className="w-4/5" />
    </div>
  )
}
