import { PageLoading } from "@/components/page-loading"

export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <PageLoading label="Loading Documind…" />
    </div>
  )
}
