import { DocumindChat } from "@/components/documind-chat"
import { SiteHeader } from "@/components/site-header"

export default function DocumindPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title="Documind" />
      <DocumindChat />
    </div>
  )
}
