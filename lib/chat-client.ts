export type ChatSummary = {
  id: string
  title: string
  createdAt: string | Date
  updatedAt: string | Date
}

export type ChatMessageDTO = {
  id: string
  role: string
  content: string | null
  createdAt: string | Date
  attachments: {
    id: string
    name: string
    contentType: string | null
    size: number | null
    status: string
  }[]
}

/** Docs pinned to the whole chat (used for RAG every turn). */
export type ChatScopedDocument = {
  id: string
  name: string
  contentType: string | null
  size: number | null
  status: string
}

export async function listChats(): Promise<ChatSummary[]> {
  const res = await fetch("/api/chats", { cache: "no-store" })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to load chats")
  }
  const data = (await res.json()) as { chats: ChatSummary[] }
  return data.chats
}

export async function createChat(input: {
  content?: string
  documentIds?: string[]
}) {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to create chat")
  }
  return (await res.json()) as {
    chat: ChatSummary
    messages: ChatMessageDTO[]
    userMessageId?: string
  }
}

export type ChatModelOption = {
  id: string
  label: string
  provider: string
  description: string
}

export async function listChatModels() {
  const res = await fetch("/api/models", { cache: "no-store" })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to load models")
  }
  return (await res.json()) as {
    models: ChatModelOption[]
    defaultModelId: string | null
  }
}

/** Create chat + stream assistant (B2/B3). Returns final text and new chat id. */
export async function streamCreateChat(
  input: { content?: string; documentIds?: string[]; modelId?: string },
  onToken: (token: string) => void
) {
  const res = await fetch("/api/chats/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to start chat stream")
  }
  const chatId = res.headers.get("X-Chat-Id")
  if (!chatId) throw new Error("Missing chat id from stream")
  const titleHeader = res.headers.get("X-Chat-Title")
  let title: string | undefined
  if (titleHeader) {
    try {
      title = decodeURIComponent(titleHeader)
    } catch {
      title = titleHeader
    }
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("No stream body")
  const decoder = new TextDecoder()
  let full = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onToken(chunk)
  }
  return { chatId, content: full, title }
}

/** Append user message + stream assistant on existing chat. */
export async function streamChatMessage(
  chatId: string,
  input: { content?: string; documentIds?: string[]; modelId?: string },
  onToken: (token: string) => void
) {
  const res = await fetch(`/api/chats/${chatId}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to stream message")
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No stream body")
  const decoder = new TextDecoder()
  let full = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onToken(chunk)
  }
  return { content: full }
}

export async function getChat(chatId: string) {
  const res = await fetch(`/api/chats/${chatId}`, { cache: "no-store" })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to load chat")
  }
  return (await res.json()) as {
    chat: ChatSummary
    messages: ChatMessageDTO[]
    scopedDocuments: ChatScopedDocument[]
  }
}

export async function pinChatDocuments(
  chatId: string,
  documentIds: string[]
) {
  const res = await fetch(`/api/chats/${chatId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to pin documents")
  }
  return (await res.json()) as { documents: ChatScopedDocument[] }
}

export async function unpinChatDocument(chatId: string, documentId: string) {
  const res = await fetch(
    `/api/chats/${chatId}/documents?documentId=${encodeURIComponent(documentId)}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to unpin document")
  }
  return (await res.json()) as { documents: ChatScopedDocument[] }
}

export async function sendChatMessage(
  chatId: string,
  input: { content?: string; documentIds?: string[] }
) {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to send message")
  }
  return (await res.json()) as {
    chat: ChatSummary
    messages: ChatMessageDTO[]
  }
}

export async function renameChat(chatId: string, title: string) {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to rename chat")
  }
  return (await res.json()) as { chat: ChatSummary }
}

export async function deleteChat(chatId: string) {
  const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? "Failed to delete chat")
  }
  return (await res.json()) as { ok: true; id: string }
}
