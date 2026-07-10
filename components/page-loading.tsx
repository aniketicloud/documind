import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function PageLoading({
  label = "Loading…",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
