export type PresignResponse = {
  documentId: string
  uploadUrl: string
}

export type ConfirmedDocument = {
  id: string
  name: string
  contentType: string | null
  size: number | null
  status: string
  createdAt: string | Date
  updatedAt?: string | Date
}

export type ListedDocument = ConfirmedDocument

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileExtensionLabel(name: string) {
  const ext = name.split(".").pop()?.toUpperCase()
  return ext || "FILE"
}

export function describeFile(name: string, size?: number | null) {
  const label = fileExtensionLabel(name)
  if (typeof size === "number") {
    return `${label} · ${formatFileSize(size)}`
  }
  return label
}

/** Presign → PUT to RustFS → confirm metadata in Postgres */
export async function uploadDocument(file: File): Promise<ConfirmedDocument> {
  const presignRes = await fetch("/api/documents/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  })

  if (!presignRes.ok) {
    const data = (await presignRes.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(data?.error ?? "Failed to start upload")
  }

  const presign = (await presignRes.json()) as PresignResponse

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status})`)
  }

  const confirmRes = await fetch("/api/documents/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId: presign.documentId }),
  })

  if (!confirmRes.ok) {
    const data = (await confirmRes.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(data?.error ?? "Failed to confirm upload")
  }

  const data = (await confirmRes.json()) as { document: ConfirmedDocument }
  return data.document
}

/** Lists documents for the signed-in user only (server enforces ownership). */
export async function listDocuments(options?: {
  status?: "pending" | "ready" | "failed"
}): Promise<ListedDocument[]> {
  const params = new URLSearchParams()
  if (options?.status) {
    params.set("status", options.status)
  }

  const query = params.toString()
  const res = await fetch(
    `/api/documents${query ? `?${query}` : ""}`,
    { method: "GET", cache: "no-store" }
  )

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(data?.error ?? "Failed to list documents")
  }

  const data = (await res.json()) as { documents: ListedDocument[] }
  return data.documents
}

export async function getDocumentDownloadUrl(documentId: string) {
  const res = await fetch(`/api/documents/${documentId}/download`, {
    method: "GET",
    cache: "no-store",
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(data?.error ?? "Failed to get download URL")
  }

  return (await res.json()) as {
    downloadUrl: string
    expiresIn: number
    document: {
      id: string
      name: string
      contentType: string | null
      size: number | null
    }
  }
}

/** Permanently delete document metadata and the RustFS object (owner only). */
export async function deleteDocument(documentId: string) {
  const res = await fetch(`/api/documents/${documentId}`, {
    method: "DELETE",
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(data?.error ?? "Failed to delete document")
  }

  return (await res.json()) as { ok: true; id: string }
}
