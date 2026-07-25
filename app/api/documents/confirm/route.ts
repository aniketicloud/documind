import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import {
  getOwnedDocument,
  isKeyOwnedByUser,
  toPublicDocument,
} from "@/lib/documents-access"
import { enqueueDocumentIngest } from "@/lib/ingest"
import { objectExists } from "@/lib/s3"
import { requireSession } from "@/lib/session"

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { documentId?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const documentId = body.documentId?.trim()
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    )
  }

  try {
    const userId = session.user.id
    const doc = await getOwnedDocument(userId, documentId)

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!isKeyOwnedByUser(doc.key, userId)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Already past storage confirm — still ensure ingest is queued when needed
    if (
      doc.status === "ready" ||
      doc.status === "processing" ||
      doc.status === "indexed"
    ) {
      if (doc.status === "ready") {
        const { document } = await enqueueDocumentIngest({
          documentId: doc.id,
          userId,
        })
        return NextResponse.json({
          document: toPublicDocument(document),
        })
      }
      return NextResponse.json({ document: toPublicDocument(doc) })
    }

    const head = await objectExists(doc.key)
    if (!head.exists) {
      await db
        .update(documents)
        .set({
          status: "failed",
          errorMessage: "Object not found in storage. Upload may have failed.",
        })
        .where(and(eq(documents.id, doc.id), eq(documents.userId, userId)))

      return NextResponse.json(
        { error: "Object not found in storage. Upload may have failed." },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(documents)
      .set({
        status: "ready",
        contentType: head.contentType ?? doc.contentType,
        size: head.size ?? doc.size,
        errorMessage: null,
      })
      .where(and(eq(documents.id, doc.id), eq(documents.userId, userId)))
      .returning()

    // Option A: enqueue async ingest (does not block upload UX long)
    const { document: afterIngest } = await enqueueDocumentIngest({
      documentId: updated.id,
      userId,
    })

    return NextResponse.json({
      document: toPublicDocument(afterIngest),
    })
  } catch (error) {
    console.error("[documents/confirm]", error)
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    )
  }
}
