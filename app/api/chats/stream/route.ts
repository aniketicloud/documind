import { NextResponse } from "next/server"

import { createChatWithFirstMessage, saveAssistantMessage } from "@/lib/chats"
import { streamRagAnswer } from "@/lib/rag"
import { requireSession } from "@/lib/session"

/**
 * POST /api/chats/stream
 * Creates a chat + user message, streams assistant answer, saves assistant message.
 * Headers: X-Chat-Id on response for client navigation.
 */
export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  if (!content && documentIds.length === 0) {
    return NextResponse.json(
      { error: "Message text or at least one document is required" },
      { status: 400 }
    )
  }

  try {
    const created = await createChatWithFirstMessage({
      userId: session.user.id,
      content: content || undefined,
      documentIds,
    })

    // RAG uses chat-scoped docs (pinned on create when documentIds provided)
    const ragDocumentIds =
      created.scopedDocuments?.map((d) => d.id) ?? documentIds

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
            chatId: created.chat.id,
            content: full,
          })
          controller.close()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream failed"
          console.error("[chats/stream]", error)
          const fallback = `Sorry — generation failed: ${message}`
          try {
            controller.enqueue(encoder.encode(fallback))
            await saveAssistantMessage({
              userId: session.user.id,
              chatId: created.chat.id,
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
        "X-Chat-Id": created.chat.id,
        "X-Chat-Title": encodeURIComponent(created.chat.title),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create chat stream"
    console.error("[chats/stream]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
