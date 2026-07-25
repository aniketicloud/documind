import { and, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import { toPublicDocument } from "@/lib/documents-access"
import { requireSession } from "@/lib/session"

/**
 * GET /api/documents
 * Lists documents for the authenticated user only.
 *
 * Query:
 * - status: optional filter (pending | ready | processing | indexed | failed). Omit for all.
 */
export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.trim()

    const allowedStatus = new Set([
      "pending",
      "ready",
      "processing",
      "indexed",
      "failed",
    ])
    if (status && !allowedStatus.has(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Use pending, ready, processing, indexed, or failed.",
        },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const conditions = [eq(documents.userId, userId)]
    if (status) {
      conditions.push(eq(documents.status, status))
    }

    const rows = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))

    // Never expose storage key or other users' rows
    return NextResponse.json({
      documents: rows.map(toPublicDocument),
    })
  } catch (error) {
    console.error("[documents]", error)
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    )
  }
}
