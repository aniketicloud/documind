import { NextResponse } from "next/server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import { buildUserObjectKey } from "@/lib/documents-access"
import {
  resolveDocumentContentType,
  validateDocumentFile,
} from "@/lib/document-types"
import {
  createPresignedUploadUrl,
  ensureBucket,
  sanitizeFilename,
} from "@/lib/s3"
import { requireSession } from "@/lib/session"

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    filename?: string
    contentType?: string
    size?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const filename = body.filename?.trim()
  const size = body.size
  const validation = validateDocumentFile({
    filename: filename ?? "",
    contentType: body.contentType,
    size,
  })

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  if (typeof size !== "number" || !Number.isFinite(size)) {
    return NextResponse.json(
      { error: "size must be a positive number" },
      { status: 400 }
    )
  }

  const contentType = resolveDocumentContentType(filename!, body.contentType)

  try {
    await ensureBucket()

    const userId = session.user.id
    const documentId = crypto.randomUUID()
    const safeName = sanitizeFilename(filename!)
    const key = buildUserObjectKey(userId, documentId, safeName)

    await db.insert(documents).values({
      id: documentId,
      userId,
      name: filename!,
      key,
      contentType,
      size,
      status: "pending",
    })

    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType,
    })

    return NextResponse.json({
      documentId,
      uploadUrl,
      contentType,
    })
  } catch (error) {
    console.error("[documents/presign]", error)
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    )
  }
}
