import { NextResponse } from "next/server"

import {
  createChatWithFirstMessage,
  listUserChats,
} from "@/lib/chats"
import { requireSession } from "@/lib/session"

/** GET /api/chats — list current user's chats (history). */
export async function GET() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const chats = await listUserChats(session.user.id)
    return NextResponse.json({ chats })
  } catch (error) {
    console.error("[chats GET]", error)
    return NextResponse.json(
      { error: "Failed to list chats" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chats — create a chat from the first message (+ optional docs).
 * Body: { content?: string, documentIds?: string[] }
 */
export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { content?: string; documentIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const result = await createChatWithFirstMessage({
      userId: session.user.id,
      content: body.content,
      documentIds: Array.isArray(body.documentIds) ? body.documentIds : [],
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create chat"
    const status =
      message.includes("required") || message.includes("not found") ? 400 : 500
    if (status === 500) console.error("[chats POST]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
