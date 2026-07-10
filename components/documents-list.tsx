"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_EXTENSIONS,
  validateDocumentFile,
} from "@/lib/document-types"
import {
  deleteDocument,
  describeFile,
  getDocumentDownloadUrl,
  listDocuments,
  uploadDocument,
  type ListedDocument,
} from "@/lib/documents"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Download04Icon,
  File01Icon,
  RefreshIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ready") return "default"
  if (status === "failed") return "destructive"
  return "secondary"
}

export function DocumentsList() {
  const [documents, setDocuments] = React.useState<ListedDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [docToDelete, setDocToDelete] = React.useState<ListedDocument | null>(
    null
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const rows = await listDocuments()
      setDocuments(rows)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load documents"
      toast.error(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return

    const files = Array.from(fileList)
    setUploading(true)

    let successCount = 0
    for (const file of files) {
      const validation = validateDocumentFile({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      })
      if (!validation.ok) {
        toast.error(`${file.name}: ${validation.error}`)
        continue
      }

      try {
        const doc = await uploadDocument(file)
        successCount += 1
        setDocuments((current) => [doc, ...current])
        toast.success(`${doc.name} uploaded`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed"
        toast.error(`${file.name}: ${message}`)
      }
    }

    if (successCount > 0) {
      await load({ soft: true })
    }
    setUploading(false)
  }

  const handleDownload = async (doc: ListedDocument) => {
    if (doc.status !== "ready") {
      toast.error("This document is not ready to download yet.")
      return
    }

    setDownloadingId(doc.id)
    try {
      const { downloadUrl } = await getDocumentDownloadUrl(doc.id)
      window.open(downloadUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Download failed"
      toast.error(message)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!docToDelete) return

    const doc = docToDelete
    setDeletingId(doc.id)
    try {
      await deleteDocument(doc.id)
      setDocuments((current) => current.filter((item) => item.id !== doc.id))
      setDocToDelete(null)
      toast.success(`${doc.name} deleted`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete document"
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-6" />
        Loading documents…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length === 0
            ? "No documents yet."
            : `${documents.length} document${documents.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              void handleUploadFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <HugeiconsIcon
                icon={Upload04Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/new">New chat</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={refreshing || uploading}
            onClick={() => void load({ soft: true })}
          >
            {refreshing ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Allowed types: {DOCUMENT_EXTENSIONS.join(", ")} · max 50MB
      </p>

      {documents.length === 0 ? (
        <Empty className="border border-dashed py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-2xl [&_svg]:size-6">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Upload your first document</EmptyTitle>
            <EmptyDescription>
              PDF, Word, Excel, TXT, Markdown, and other text files.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon
                  icon={Upload04Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
              )}
              Choose files
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Attachment
                state={
                  doc.status === "ready"
                    ? "done"
                    : doc.status === "failed"
                      ? "error"
                      : "processing"
                }
                size="default"
                className="w-full max-w-none"
              >
                <AttachmentMedia>
                  <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{doc.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {describeFile(doc.name, doc.size)}
                    {" · "}
                    {new Date(doc.createdAt).toLocaleString()}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions className="gap-2 pr-2">
                  <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                  <AttachmentAction
                    type="button"
                    size="icon-sm"
                    aria-label={`Download ${doc.name}`}
                    disabled={
                      doc.status !== "ready" ||
                      downloadingId === doc.id ||
                      deletingId === doc.id
                    }
                    onClick={() => void handleDownload(doc)}
                  >
                    <HugeiconsIcon icon={Download04Icon} strokeWidth={2} />
                  </AttachmentAction>
                  <AttachmentAction
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    aria-label={`Delete ${doc.name}`}
                    disabled={deletingId === doc.id}
                    onClick={() => setDocToDelete(doc)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={docToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setDocToDelete(null)
          }
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {docToDelete ? (
                <>
                  Delete{" "}
                  <span className="font-medium text-foreground">
                    {docToDelete.name}
                  </span>
                  ? This removes it from your account and from storage. This
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!!deletingId}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {deletingId ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
