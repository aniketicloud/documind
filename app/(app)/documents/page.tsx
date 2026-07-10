import { DocumentsList } from "@/components/documents-list"
import { SiteHeader } from "@/components/site-header"

export default function DocumentsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title="My documents" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Uploaded documents
            </h2>
            <p className="text-sm text-muted-foreground">
              Only files you uploaded appear here. Other users cannot see or
              download your documents.
            </p>
          </div>
          <DocumentsList />
        </div>
      </div>
    </div>
  )
}
