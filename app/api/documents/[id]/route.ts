import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import {
  getOwnedDocument,
  isKeyOwnedByUser,
  toPublicDocument,
} from "@/lib/documents-access"
import { deleteObject } from "@/lib/s3"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/documents/:id
 * Returns metadata for one document owned by the current user.
 * Other users receive 404 (no existence leak).
 */
export async function GET(_request: Request, context: RouteContext) {
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

    return NextResponse.json({ document: toPublicDocument(doc) })
  } catch (error) {
    console.error("[documents/:id]", error)
    return NextResponse.json(
      { error: "Failed to load document" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/documents/:id
 * Owner only: remove object from RustFS and delete the Postgres row.
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

    // Storage first, then DB — so a failed storage delete can be retried
    await deleteObject(doc.key)

    await db
      .delete(documents)
      .where(and(eq(documents.id, doc.id), eq(documents.userId, userId)))

    return NextResponse.json({
      ok: true,
      id: doc.id,
    })
  } catch (error) {
    console.error("[documents/:id DELETE]", error)
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}
