import { NextResponse } from "next/server"

import { db } from "@/db"
import { documents } from "@/db/schema"
import { buildUserObjectKey } from "@/lib/documents-access"
import {
  createPresignedUploadUrl,
  ensureBucket,
  sanitizeFilename,
} from "@/lib/s3"
import { requireSession } from "@/lib/session"

const MAX_BYTES = 50 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/rtf",
  "application/octet-stream",
])

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
  const contentType = body.contentType?.trim() || "application/octet-stream"
  const size = body.size

  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 })
  }

  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json(
      { error: "size must be a positive number" },
      { status: 400 }
    )
  }

  if (size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 50MB limit" },
      { status: 400 }
    )
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType}` },
      { status: 400 }
    )
  }

  try {
    await ensureBucket()

    const userId = session.user.id
    const documentId = crypto.randomUUID()
    const safeName = sanitizeFilename(filename)
    // Always under this user — never accept client-provided keys/paths
    const key = buildUserObjectKey(userId, documentId, safeName)

    await db.insert(documents).values({
      id: documentId,
      userId,
      name: filename,
      key,
      contentType,
      size,
      status: "pending",
    })

    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType,
    })

    // Do not return storage key — reduces accidental leakage in client logs
    return NextResponse.json({
      documentId,
      uploadUrl,
    })
  } catch (error) {
    console.error("[documents/presign]", error)
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    )
  }
}
