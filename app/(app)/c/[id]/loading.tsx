/**
 * Soft shell while the chat route resolves.
 * Avoid a full-page spinner after /new → /c/[id]; the workspace may already have a handoff.
 */
export default function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="min-h-0 flex-1" />
      <div className="border-t p-4">
        <div className="mx-auto h-24 max-w-3xl animate-pulse rounded-2xl bg-muted/60" />
      </div>
    </div>
  )
}
