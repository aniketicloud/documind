import { and, asc, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import {
  chatDocuments,
  chatMessageDocuments,
  chatMessages,
  chats,
  documents,
} from "@/db/schema"

export type ChatSummary = {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
}

export type ChatScopedDocument = {
  id: string
  name: string
  contentType: string | null
  size: number | null
  status: string
}

export type ChatMessageDTO = {
  id: string
  role: string
  content: string | null
  createdAt: Date
  attachments: {
    id: string
    name: string
    contentType: string | null
    size: number | null
    status: string
  }[]
}

export function makeChatTitle(input: {
  text?: string | null
  firstDocumentName?: string | null
}) {
  const raw =
    input.text?.trim() ||
    input.firstDocumentName?.trim() ||
    "New chat"
  const collapsed = raw.replace(/\s+/g, " ")
  if (collapsed.length <= 60) return collapsed
  return `${collapsed.slice(0, 57)}…`
}

export async function listUserChats(userId: string): Promise<ChatSummary[]> {
  return db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt))
}

export async function getOwnedChat(userId: string, chatId: string) {
  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1)
  return chat ?? null
}

export async function getChatMessages(chatId: string): Promise<ChatMessageDTO[]> {
  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt))

  if (rows.length === 0) return []

  const messageIds = rows.map((row) => row.id)
  const links = await db
    .select({
      messageId: chatMessageDocuments.messageId,
      documentId: documents.id,
      name: documents.name,
      contentType: documents.contentType,
      size: documents.size,
      status: documents.status,
    })
    .from(chatMessageDocuments)
    .innerJoin(
      documents,
      eq(chatMessageDocuments.documentId, documents.id)
    )
    .where(inArray(chatMessageDocuments.messageId, messageIds))

  const byMessage = new Map<string, ChatMessageDTO["attachments"]>()
  for (const link of links) {
    const list = byMessage.get(link.messageId) ?? []
    list.push({
      id: link.documentId,
      name: link.name,
      contentType: link.contentType,
      size: link.size,
      status: link.status,
    })
    byMessage.set(link.messageId, list)
  }

  return rows.map((row) => ({
    ...row,
    attachments: byMessage.get(row.id) ?? [],
  }))
}

/** Ensure all document IDs exist and belong to the user. */
export async function assertOwnedDocumentIds(
  userId: string,
  documentIds: string[]
) {
  if (documentIds.length === 0) return []

  const unique = [...new Set(documentIds)]
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      status: documents.status,
      contentType: documents.contentType,
      size: documents.size,
    })
    .from(documents)
    .where(
      and(eq(documents.userId, userId), inArray(documents.id, unique))
    )

  if (rows.length !== unique.length) {
    throw new Error("One or more documents were not found")
  }

  return rows
}

/** Documents pinned to this chat for RAG on every turn. */
export async function getChatScopedDocuments(
  userId: string,
  chatId: string
): Promise<ChatScopedDocument[]> {
  const chat = await getOwnedChat(userId, chatId)
  if (!chat) return []

  return db
    .select({
      id: documents.id,
      name: documents.name,
      contentType: documents.contentType,
      size: documents.size,
      status: documents.status,
    })
    .from(chatDocuments)
    .innerJoin(documents, eq(chatDocuments.documentId, documents.id))
    .where(
      and(eq(chatDocuments.chatId, chatId), eq(documents.userId, userId))
    )
    .orderBy(asc(chatDocuments.createdAt))
}

/**
 * Pin documents to a chat (idempotent). Only owner’s docs.
 * Returns the full scoped list after update.
 */
export async function addDocumentsToChatScope(options: {
  userId: string
  chatId: string
  documentIds: string[]
}) {
  const chat = await getOwnedChat(options.userId, options.chatId)
  if (!chat) return null

  const unique = [...new Set(options.documentIds.filter(Boolean))]
  if (unique.length === 0) {
    return getChatScopedDocuments(options.userId, options.chatId)
  }

  await assertOwnedDocumentIds(options.userId, unique)

  const existing = await db
    .select({ documentId: chatDocuments.documentId })
    .from(chatDocuments)
    .where(eq(chatDocuments.chatId, options.chatId))

  const have = new Set(existing.map((r) => r.documentId))
  const toInsert = unique.filter((id) => !have.has(id))
  if (toInsert.length > 0) {
    await db.insert(chatDocuments).values(
      toInsert.map((documentId) => ({
        chatId: options.chatId,
        documentId,
      }))
    )
  }

  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(
      and(eq(chats.id, options.chatId), eq(chats.userId, options.userId))
    )

  return getChatScopedDocuments(options.userId, options.chatId)
}

export async function removeDocumentFromChatScope(options: {
  userId: string
  chatId: string
  documentId: string
}) {
  const chat = await getOwnedChat(options.userId, options.chatId)
  if (!chat) return null

  await db
    .delete(chatDocuments)
    .where(
      and(
        eq(chatDocuments.chatId, options.chatId),
        eq(chatDocuments.documentId, options.documentId)
      )
    )

  return getChatScopedDocuments(options.userId, options.chatId)
}

/** Replace entire chat document scope. */
export async function setChatDocumentScope(options: {
  userId: string
  chatId: string
  documentIds: string[]
}) {
  const chat = await getOwnedChat(options.userId, options.chatId)
  if (!chat) return null

  const unique = [...new Set(options.documentIds.filter(Boolean))]
  if (unique.length > 0) {
    await assertOwnedDocumentIds(options.userId, unique)
  }

  await db
    .delete(chatDocuments)
    .where(eq(chatDocuments.chatId, options.chatId))

  if (unique.length > 0) {
    await db.insert(chatDocuments).values(
      unique.map((documentId) => ({
        chatId: options.chatId,
        documentId,
      }))
    )
  }

  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(
      and(eq(chats.id, options.chatId), eq(chats.userId, options.userId))
    )

  return getChatScopedDocuments(options.userId, options.chatId)
}

export async function createChatWithFirstMessage(options: {
  userId: string
  content?: string
  documentIds?: string[]
}) {
  const content = options.content?.trim() || null
  const documentIds = options.documentIds ?? []

  if (!content && documentIds.length === 0) {
    throw new Error("Message text or at least one document is required")
  }

  const ownedDocs = await assertOwnedDocumentIds(options.userId, documentIds)
  const title = makeChatTitle({
    text: content,
    firstDocumentName: ownedDocs[0]?.name,
  })

  const chatId = crypto.randomUUID()
  const userMessageId = crypto.randomUUID()
  const now = new Date()

  await db.insert(chats).values({
    id: chatId,
    userId: options.userId,
    title,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(chatMessages).values({
    id: userMessageId,
    chatId,
    role: "user",
    content,
    createdAt: now,
  })

  if (documentIds.length > 0) {
    await db.insert(chatMessageDocuments).values(
      documentIds.map((documentId) => ({
        messageId: userMessageId,
        documentId,
      }))
    )
    // Pin to chat scope so follow-up turns keep using these docs
    await db.insert(chatDocuments).values(
      documentIds.map((documentId) => ({
        chatId,
        documentId,
      }))
    )
  }

  const messages = await getChatMessages(chatId)
  const scopedDocuments = await getChatScopedDocuments(options.userId, chatId)
  return {
    chat: {
      id: chatId,
      title,
      createdAt: now,
      updatedAt: now,
    },
    messages,
    userMessageId,
    scopedDocuments,
  }
}

export async function addMessageToChat(options: {
  userId: string
  chatId: string
  content?: string
  documentIds?: string[]
}) {
  const chat = await getOwnedChat(options.userId, options.chatId)
  if (!chat) return null

  const content = options.content?.trim() || null
  const documentIds = options.documentIds ?? []

  // Allow text-only if chat already has scoped docs (RAG without re-attaching)
  const scopedBefore = await getChatScopedDocuments(options.userId, chat.id)
  if (!content && documentIds.length === 0 && scopedBefore.length === 0) {
    throw new Error("Message text or at least one document is required")
  }

  if (documentIds.length > 0) {
    await assertOwnedDocumentIds(options.userId, documentIds)
    await addDocumentsToChatScope({
      userId: options.userId,
      chatId: chat.id,
      documentIds,
    })
  }

  const userMessageId = crypto.randomUUID()
  const now = new Date()

  await db.insert(chatMessages).values({
    id: userMessageId,
    chatId: chat.id,
    role: "user",
    content,
    createdAt: now,
  })

  // Link turn attachments on the message (for history); may be empty if using scope only
  if (documentIds.length > 0) {
    await db.insert(chatMessageDocuments).values(
      documentIds.map((documentId) => ({
        messageId: userMessageId,
        documentId,
      }))
    )
  }

  await db
    .update(chats)
    .set({ updatedAt: now })
    .where(and(eq(chats.id, chat.id), eq(chats.userId, options.userId)))

  const messages = await getChatMessages(chat.id)
  const scopedDocuments = await getChatScopedDocuments(options.userId, chat.id)
  return {
    chat: { ...chat, updatedAt: now },
    messages,
    userMessageId,
    scopedDocuments,
    /**
     * RAG uses only IDs the client selected for this turn (documentIds),
     * not every pinned chat doc. Pins stay in scopedDocuments for the panel.
     */
    ragDocumentIds: documentIds,
  }
}

/** Persist streaming assistant reply after generation. */
export async function saveAssistantMessage(options: {
  userId: string
  chatId: string
  content: string
}) {
  const chat = await getOwnedChat(options.userId, options.chatId)
  if (!chat) return null

  const now = new Date()
  const id = crypto.randomUUID()
  await db.insert(chatMessages).values({
    id,
    chatId: chat.id,
    role: "assistant",
    content: options.content,
    createdAt: now,
  })
  await db
    .update(chats)
    .set({ updatedAt: now })
    .where(and(eq(chats.id, chat.id), eq(chats.userId, options.userId)))

  return { id, chatId: chat.id, content: options.content, createdAt: now }
}

export async function renameOwnedChat(
  userId: string,
  chatId: string,
  title: string
) {
  const chat = await getOwnedChat(userId, chatId)
  if (!chat) return null

  const nextTitle = title.replace(/\s+/g, " ").trim()
  if (!nextTitle) {
    throw new Error("Title is required")
  }
  if (nextTitle.length > 120) {
    throw new Error("Title must be 120 characters or less")
  }

  const now = new Date()
  const [updated] = await db
    .update(chats)
    .set({ title: nextTitle, updatedAt: now })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })

  return updated ?? null
}

export async function deleteOwnedChat(userId: string, chatId: string) {
  const chat = await getOwnedChat(userId, chatId)
  if (!chat) return false

  // Cascades: chat_messages → chat_message_documents
  await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))

  return true
}
