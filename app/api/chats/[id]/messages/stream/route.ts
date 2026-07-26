import { NextResponse } from "next/server"

import {
  addMessageToChat,
  getChatScopedDocuments,
  getOwnedChat,
  saveAssistantMessage,
} from "@/lib/chats"
import { streamRagAnswer } from "@/lib/rag"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/chats/:id/messages/stream
 * Body: { content?: string, documentIds?: string[], modelId?: string }
 * documentIds = docs selected for RAG this turn (subset of chat pins / new attaches).
 * Pins are managed separately; unselected pins stay in the chat list.
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

  let body: { content?: string; documentIds?: string[]; modelId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const content = body.content?.trim() || ""
  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : []
  const modelId = body.modelId?.trim() || undefined

  try {
    const chat = await getOwnedChat(session.user.id, chatId)
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const scoped = await getChatScopedDocuments(session.user.id, chatId)
    if (!content && documentIds.length === 0 && scoped.length === 0) {
      return NextResponse.json(
        { error: "Message text or at least one document is required" },
        { status: 400 }
      )
    }

    // Persist user turn; pins any new documentIds; RAG uses selection only
    const added = await addMessageToChat({
      userId: session.user.id,
      chatId,
      content: content || undefined,
      documentIds,
    })

    const ragDocumentIds = added?.ragDocumentIds ?? documentIds

    const query =
      content ||
      "Summarize the main points of the attached document(s)."

    const encoder = new TextEncoder()
    let full = ""

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of streamRagAnswer({
            userId: session.user.id,
            documentIds: ragDocumentIds,
            query,
            modelId,
          })) {
            full += token
            controller.enqueue(encoder.encode(token))
          }

          if (!full.trim()) {
            full =
              "I could not generate a response. Check ZAI_API_KEY / GEMINI_API_KEY and try again."
            controller.enqueue(encoder.encode(full))
          }

          await saveAssistantMessage({
            userId: session.user.id,
            chatId,
            content: full,
          })
          controller.close()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream failed"
          console.error("[messages/stream]", error)
          const fallback = `Sorry — generation failed: ${message}`
          try {
            controller.enqueue(encoder.encode(fallback))
            await saveAssistantMessage({
              userId: session.user.id,
              chatId,
              content: fallback,
            })
          } catch {
            // ignore
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Chat-Id": chatId,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream message"
    console.error("[messages/stream]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
