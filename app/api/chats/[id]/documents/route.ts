import { NextResponse } from "next/server"

import {
  addDocumentsToChatScope,
  getChatScopedDocuments,
  getOwnedChat,
  removeDocumentFromChatScope,
  setChatDocumentScope,
} from "@/lib/chats"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/** GET /api/chats/:id/documents — list docs pinned to this chat. */
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
    const documents = await getChatScopedDocuments(session.user.id, chatId)
    return NextResponse.json({ documents })
  } catch (error) {
    console.error("[chats/:id/documents GET]", error)
    return NextResponse.json(
      { error: "Failed to list chat documents" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/chats/:id/documents — replace chat document scope.
 * Body: { documentIds: string[] }
 */
export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  let body: { documentIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : []

  try {
    const documents = await setChatDocumentScope({
      userId: session.user.id,
      chatId,
      documentIds,
    })
    if (!documents) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }
    return NextResponse.json({ documents })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update chat documents"
    console.error("[chats/:id/documents PUT]", error)
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 400 : 500 }
    )
  }
}

/**
 * POST /api/chats/:id/documents — pin more documents (idempotent).
 * Body: { documentIds: string[] }
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

  let body: { documentIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : []
  if (documentIds.length === 0) {
    return NextResponse.json(
      { error: "documentIds is required" },
      { status: 400 }
    )
  }

  try {
    const documents = await addDocumentsToChatScope({
      userId: session.user.id,
      chatId,
      documentIds,
    })
    if (!documents) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }
    return NextResponse.json({ documents })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to pin documents"
    console.error("[chats/:id/documents POST]", error)
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 400 : 500 }
    )
  }
}

/**
 * DELETE /api/chats/:id/documents?documentId=
 * Unpin one document from chat scope.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const chatId = id?.trim()
  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 })
  }

  const documentId = new URL(request.url).searchParams.get("documentId")?.trim()
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId query is required" },
      { status: 400 }
    )
  }

  try {
    const documents = await removeDocumentFromChatScope({
      userId: session.user.id,
      chatId,
      documentId,
    })
    if (!documents) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }
    return NextResponse.json({ documents })
  } catch (error) {
    console.error("[chats/:id/documents DELETE]", error)
    return NextResponse.json(
      { error: "Failed to unpin document" },
      { status: 500 }
    )
  }
}
