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
  }
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
  }
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
