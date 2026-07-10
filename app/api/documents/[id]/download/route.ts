import { NextResponse } from "next/server"

import {
  getOwnedDocument,
  isKeyOwnedByUser,
} from "@/lib/documents-access"
import { createPresignedDownloadUrl } from "@/lib/s3"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/documents/:id/download
 * Short-lived presigned GET URL for the owner only.
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const documentId = id?.trim()
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 })
  }

  try {
    const userId = session.user.id
    const doc = await getOwnedDocument(userId, documentId)

    if (!doc || !isKeyOwnedByUser(doc.key, userId)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (doc.status !== "ready") {
      return NextResponse.json(
        { error: "Document is not ready for download" },
        { status: 400 }
      )
    }

    const downloadUrl = await createPresignedDownloadUrl({
      key: doc.key,
      filename: doc.name,
      expiresIn: 300,
    })

    return NextResponse.json({
      downloadUrl,
      expiresIn: 300,
      document: {
        id: doc.id,
        name: doc.name,
        contentType: doc.contentType,
        size: doc.size,
      },
    })
  } catch (error) {
    console.error("[documents/:id/download]", error)
    return NextResponse.json(
      { error: "Failed to create download URL" },
      { status: 500 }
    )
  }
}
