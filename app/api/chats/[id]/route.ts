import { NextResponse } from "next/server"

import {
  deleteOwnedChat,
  getChatMessages,
  getOwnedChat,
  renameOwnedChat,
} from "@/lib/chats"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/** GET /api/chats/:id — chat + messages for owner only. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  try {
    const chat = await getOwnedChat(session.user.id, chatId)
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const messages = await getChatMessages(chat.id)
    return NextResponse.json({
      chat: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      messages,
    })
  } catch (error) {
    console.error("[chats/:id GET]", error)
    return NextResponse.json(
      { error: "Failed to load chat" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/chats/:id — rename chat (owner only).
 * Body: { title: string }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  let body: { title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const chat = await renameOwnedChat(
      session.user.id,
      chatId,
      body.title ?? ""
    )
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }
    return NextResponse.json({ chat })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename chat"
    const status =
      message.includes("required") || message.includes("120") ? 400 : 500
    if (status === 500) console.error("[chats/:id PATCH]", error)
    return NextResponse.json({ error: message }, { status })
  }
}

/** DELETE /api/chats/:id — hard-delete chat + messages (docs kept). */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  try {
    const deleted = await deleteOwnedChat(session.user.id, chatId)
    if (!deleted) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, id: chatId })
  } catch (error) {
    console.error("[chats/:id DELETE]", error)
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    )
  }
}
