/**
 * In-memory + sessionStorage handoff when leaving /new after the first stream.
 * Avoids a full "Loading chat…" flash on /c/[id] by painting streamed messages immediately.
 */

import type {
  ChatMessageDTO,
  ChatScopedDocument,
  ChatSummary,
} from "@/lib/chat-client"

const STORAGE_KEY = "documind:chat-handoff"
const MAX_AGE_MS = 2 * 60 * 1000

export type ChatHandoffPayload = {
  chatId: string
  chat: ChatSummary
  messages: ChatMessageDTO[]
  scopedDocuments: ChatScopedDocument[]
  createdAt: number
}

let memory: ChatHandoffPayload | null = null

export function setChatHandoff(
  payload: Omit<ChatHandoffPayload, "createdAt">
) {
  const next: ChatHandoffPayload = {
    ...payload,
    createdAt: Date.now(),
  }
  memory = next
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // private mode / quota — memory still works in same tab
  }
}

/** Read and clear handoff if it matches chatId and is fresh. */
export function takeChatHandoff(chatId: string): ChatHandoffPayload | null {
  const fromMemory =
    memory && memory.chatId === chatId ? memory : null

  let fromStorage: ChatHandoffPayload | null = null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ChatHandoffPayload
      if (parsed?.chatId === chatId) fromStorage = parsed
    }
  } catch {
    // ignore
  }

  const candidate = fromMemory ?? fromStorage
  memory = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }

  if (!candidate) return null
  if (Date.now() - candidate.createdAt > MAX_AGE_MS) return null
  if (candidate.chatId !== chatId) return null
  return candidate
}
