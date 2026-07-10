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
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteDocument,
  describeFile,
  getDocumentDownloadUrl,
  listDocuments,
  type ListedDocument,
} from "@/lib/documents"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Download04Icon,
  File01Icon,
  RefreshIcon,
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
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [docToDelete, setDocToDelete] = React.useState<ListedDocument | null>(
    null
  )

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
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {documents.length === 0
            ? "No documents yet."
            : `${documents.length} document${documents.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/documind">Upload in Documind</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={() => void load({ soft: true })}
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Upload a file from{" "}
            <Link
              href="/documind"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Documind
            </Link>{" "}
            to see it listed here.
          </p>
        </div>
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
                  Delete <span className="font-medium text-foreground">{docToDelete.name}</span>?
                  This removes it from your account and from storage. This
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
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
