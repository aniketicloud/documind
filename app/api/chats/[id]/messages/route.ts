import { NextResponse } from "next/server"

import { addMessageToChat } from "@/lib/chats"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/chats/:id/messages
 * Body: { content?: string, documentIds?: string[] }
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  let body: { content?: string; documentIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const result = await addMessageToChat({
      userId: session.user.id,
      chatId,
      content: body.content,
      documentIds: Array.isArray(body.documentIds) ? body.documentIds : [],
    })

    if (!result) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message"
    const status =
      message.includes("required") || message.includes("not found") ? 400 : 500
    if (status === 500) console.error("[chats/:id/messages]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
