import { PageLoading } from "@/components/page-loading"
import { SiteHeader } from "@/components/site-header"

export default function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title="Chat" />
      <PageLoading label="Loading chat…" />
    </div>
  )
}
