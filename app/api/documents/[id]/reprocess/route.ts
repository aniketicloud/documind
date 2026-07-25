import { NextResponse } from "next/server"

import {
  getOwnedDocument,
  isKeyOwnedByUser,
  toPublicDocument,
} from "@/lib/documents-access"
import { enqueueDocumentIngest } from "@/lib/ingest"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/documents/:id/reprocess
 * Owner-only: re-queue ingest (force new job).
 */
export async function POST(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const documentId = id?.trim()
  if (!documentId) {
    return NextResponse.json(
      { error: "Document id is required" },
      { status: 400 }
    )
  }

  try {
    const userId = session.user.id
    const doc = await getOwnedDocument(userId, documentId)

    if (!doc || !isKeyOwnedByUser(doc.key, userId)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (doc.status === "pending") {
      return NextResponse.json(
        { error: "Document upload is not confirmed yet" },
        { status: 400 }
      )
    }

    const { document, job } = await enqueueDocumentIngest({
      documentId: doc.id,
      userId,
      force: true,
    })

    return NextResponse.json({
      document: toPublicDocument(document),
      jobId: job?.id ?? null,
    })
  } catch (error) {
    console.error("[documents/:id/reprocess]", error)
    return NextResponse.json(
      { error: "Failed to reprocess document" },
      { status: 500 }
    )
  }
}
