"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { notifyChatsChanged } from "@/components/chat-history"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { SiteHeader } from "@/components/site-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  getChat,
  listChatModels,
  pinChatDocuments,
  streamChatMessage,
  streamCreateChat,
  unpinChatDocument,
  type ChatMessageDTO,
  type ChatModelOption,
  type ChatScopedDocument,
  type ChatSummary,
} from "@/lib/chat-client"
import { setChatHandoff, takeChatHandoff } from "@/lib/chat-handoff"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DOCUMENT_ACCEPT, validateDocumentFile } from "@/lib/document-types"
import {
  describeFile,
  listDocuments,
  uploadDocument,
  type ListedDocument,
} from "@/lib/documents"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Cancel01Icon,
  File01Icon,
  Folder01Icon,
  SentIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

type AttachedDocument = {
  localId: string
  documentId?: string
  name: string
  size?: number | null
  status: "uploading" | "ready" | "error"
  error?: string
  source: "upload" | "library"
}

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key deadlines?",
  "List parties and obligations",
]

function AssistantAvatar() {
  return (
    <Avatar size="sm">
      <AvatarFallback className="bg-primary/10 text-primary">
        <HugeiconsIcon
          icon={SparklesIcon}
          strokeWidth={2}
          className="size-3.5"
        />
      </AvatarFallback>
    </Avatar>
  )
}

function UserAvatar() {
  return (
    <Avatar size="sm">
      <AvatarFallback>You</AvatarFallback>
    </Avatar>
  )
}

function FileAttachmentCard({
  title,
  description,
  state = "done",
  onRemove,
}: {
  title: string
  description: string
  state?: "idle" | "uploading" | "processing" | "error" | "done"
  onRemove?: () => void
}) {
  return (
    <Attachment state={state} size="sm">
      <AttachmentMedia>
        <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{title}</AttachmentTitle>
        <AttachmentDescription>{description}</AttachmentDescription>
      </AttachmentContent>
      {onRemove ? (
        <AttachmentActions>
          <AttachmentAction
            type="button"
            aria-label={`Remove ${title}`}
            onClick={onRemove}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </AttachmentAction>
        </AttachmentActions>
      ) : null}
    </Attachment>
  )
}

function formatTime(value: string | Date) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function ChatMessageRow({ message }: { message: ChatMessageDTO }) {
  const isUser = message.role === "user"

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageAvatar>
        {isUser ? <UserAvatar /> : <AssistantAvatar />}
      </MessageAvatar>
      <MessageContent>
        {!isUser ? <MessageHeader>Documind</MessageHeader> : null}

        {message.attachments.length > 0 ? (
          <AttachmentGroup>
            {message.attachments.map((file) => (
              <FileAttachmentCard
                key={file.id}
                title={file.name}
                description={describeFile(file.name, file.size)}
              />
            ))}
          </AttachmentGroup>
        ) : null}

        {message.content || (!isUser && message.content === "") ? (
          <Bubble
            variant={isUser ? "default" : "ghost"}
            align={isUser ? "end" : "start"}
          >
            <BubbleContent className="whitespace-pre-wrap">
              {message.content || (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Thinking…
                </span>
              )}
            </BubbleContent>
          </Bubble>
        ) : null}

        <MessageFooter>{formatTime(message.createdAt)}</MessageFooter>
      </MessageContent>
    </Message>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-16">
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-2xl bg-primary/10 text-primary [&_svg]:size-6"
          >
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle className="text-xl">How can I help you today?</EmptyTitle>
          <EmptyDescription>
            Attach indexed documents (they stay pinned for the chat), then ask
            questions. Your conversation appears in Recent on the left.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

export function ChatWorkspace({
  mode,
  chatId,
}: {
  mode: "new" | "chat"
  chatId?: string
}) {
  const router = useRouter()
  const [chat, setChat] = React.useState<ChatSummary | null>(null)
  const [messages, setMessages] = React.useState<ChatMessageDTO[]>([])
  const [scopedDocuments, setScopedDocuments] = React.useState<
    ChatScopedDocument[]
  >([])
  const [loadingChat, setLoadingChat] = React.useState(mode === "chat")
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<AttachedDocument[]>([])
  const [library, setLibrary] = React.useState<ListedDocument[]>([])
  const [libraryLoading, setLibraryLoading] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)
  const [models, setModels] = React.useState<ChatModelOption[]>([])
  const [modelId, setModelId] = React.useState<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  /** Sync lock — React state alone can't block double-clicks before re-render. */
  const submitLockRef = React.useRef(false)

  const scopedIds = React.useMemo(
    () => new Set(scopedDocuments.map((d) => d.id)),
    [scopedDocuments]
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await listChatModels()
        if (cancelled) return
        setModels(data.models)
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("documind:chat-model")
            : null
        const preferred =
          (stored && data.models.some((m) => m.id === stored) && stored) ||
          data.defaultModelId ||
          data.models[0]?.id ||
          ""
        setModelId(preferred)
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : "Failed to load models"
        toast.error(message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshLibrary = React.useCallback(async () => {
    setLibraryLoading(true)
    try {
      // B2: RAG only uses indexed docs — library picker matches that
      const rows = await listDocuments({ status: "indexed" })
      setLibrary(rows)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load documents"
      toast.error(message)
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  React.useEffect(() => {
    const onRenamed = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; title: string }>).detail
      if (!detail || mode !== "chat" || detail.id !== chatId) return
      setChat((current) =>
        current ? { ...current, title: detail.title } : current
      )
    }
    window.addEventListener("documind:chat-renamed", onRenamed)
    return () => window.removeEventListener("documind:chat-renamed", onRenamed)
  }, [mode, chatId])

  React.useEffect(() => {
    if (mode !== "chat" || !chatId) {
      setChat(null)
      setMessages([])
      setScopedDocuments([])
      setLoadingChat(false)
      return
    }

    let cancelled = false

    // Instant paint after /new → /c/[id] (streamed messages already in handoff)
    const handoff = takeChatHandoff(chatId)
    if (handoff) {
      setChat(handoff.chat)
      setMessages(handoff.messages)
      setScopedDocuments(handoff.scopedDocuments)
      setLoadingChat(false)
      // Reconcile with server in background (real message ids, etc.)
      void (async () => {
        try {
          const data = await getChat(chatId)
          if (cancelled) return
          setChat(data.chat)
          setMessages(data.messages)
          setScopedDocuments(data.scopedDocuments ?? [])
        } catch {
          // Keep handoff UI; user can refresh if needed
        }
      })()
      return () => {
        cancelled = true
      }
    }

    setLoadingChat(true)

    void (async () => {
      try {
        const data = await getChat(chatId)
        if (cancelled) return
        setChat(data.chat)
        setMessages(data.messages)
        setScopedDocuments(data.scopedDocuments ?? [])
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : "Failed to load chat"
        toast.error(message)
        router.replace("/new")
      } finally {
        if (!cancelled) setLoadingChat(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, chatId, router])

  const handlePickLocalFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return

    for (const file of Array.from(fileList)) {
      const validation = validateDocumentFile({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      })
      if (!validation.ok) {
        toast.error(`${file.name}: ${validation.error}`)
        continue
      }

      const localId = crypto.randomUUID()
      setAttachments((current) => [
        ...current,
        {
          localId,
          name: file.name,
          size: file.size,
          status: "uploading",
          source: "upload",
        },
      ])

      void (async () => {
        try {
          const doc = await uploadDocument(file)
          setAttachments((current) =>
            current.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    documentId: doc.id,
                    name: doc.name,
                    size: doc.size,
                    status: "ready" as const,
                    error: undefined,
                  }
                : item
            )
          )
          toast.success(`${doc.name} uploaded`)
          void refreshLibrary()
          // Existing chat: pin when ready (if already indexed) so follow-ups use it
          if (mode === "chat" && chatId && doc.status === "indexed") {
            try {
              const { documents: next } = await pinChatDocuments(chatId, [
                doc.id,
              ])
              setScopedDocuments(next)
            } catch {
              // pin on send instead
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed"
          setAttachments((current) =>
            current.map((item) =>
              item.localId === localId
                ? { ...item, status: "error" as const, error: message }
                : item
            )
          )
          toast.error(`${file.name}: ${message}`)
        }
      })()
    }
  }

  const handleToggleLibraryDoc = (doc: ListedDocument) => {
    // Existing chat: pin/unpin to chat scope (persists for all turns)
    if (mode === "chat" && chatId) {
      if (scopedIds.has(doc.id)) {
        void (async () => {
          try {
            const { documents: next } = await unpinChatDocument(chatId, doc.id)
            setScopedDocuments(next)
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to unpin"
            )
          }
        })()
        return
      }
      void (async () => {
        try {
          const { documents: next } = await pinChatDocuments(chatId, [doc.id])
          setScopedDocuments(next)
          toast.success(`Added ${doc.name} to this chat`)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to pin")
        }
      })()
      return
    }

    // New chat: stage in composer until first send (then server pins)
    setAttachments((current) => {
      const exists = current.some((item) => item.documentId === doc.id)
      if (exists) {
        return current.filter((item) => item.documentId !== doc.id)
      }
      return [
        ...current,
        {
          localId: crypto.randomUUID(),
          documentId: doc.id,
          name: doc.name,
          size: doc.size,
          status: "ready",
          source: "library",
        },
      ]
    })
  }

  const handleUnpinScoped = (documentId: string) => {
    if (!chatId) return
    void (async () => {
      try {
        const { documents: next } = await unpinChatDocument(chatId, documentId)
        setScopedDocuments(next)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to unpin")
      }
    })()
  }

  const handleSend = async () => {
    // Prevent double create on /new while navigation is slow
    if (submitLockRef.current || isBusy) return

    const text = input.trim()
    const readyDocs = attachments.filter(
      (item) => item.status === "ready" && item.documentId
    )

    if (attachments.some((item) => item.status === "uploading")) {
      toast.message("Wait for uploads to finish")
      return
    }
    if (attachments.some((item) => item.status === "error")) {
      toast.error("Remove failed uploads before sending")
      return
    }
    // Existing chat can send with only scoped docs (no re-attach)
    if (!text && readyDocs.length === 0 && scopedDocuments.length === 0) return

    submitLockRef.current = true
    setIsBusy(true)
    const documentIds = readyDocs.map((doc) => doc.documentId as string)
    const sentText = text || null
    const sentAttachments =
      readyDocs.length > 0
        ? readyDocs.map((doc) => ({
            id: doc.documentId as string,
            name: doc.name,
            contentType: null as string | null,
            size: doc.size ?? null,
            status: "ready",
          }))
        : scopedDocuments.map((doc) => ({
            id: doc.id,
            name: doc.name,
            contentType: doc.contentType,
            size: doc.size,
            status: doc.status,
          }))

    // Optimistic user bubble + streaming assistant
    const tempUserId = `temp-user-${crypto.randomUUID()}`
    const tempAssistantId = `temp-assistant-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    if (mode === "new") {
      setInput("")
      setAttachments([])
      setMessages([
        {
          id: tempUserId,
          role: "user",
          content: sentText,
          createdAt: now,
          attachments: sentAttachments,
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          attachments: [],
        },
      ])
    } else {
      setInput("")
      setAttachments([])
      setMessages((current) => [
        ...current,
        {
          id: tempUserId,
          role: "user",
          content: sentText,
          createdAt: now,
          attachments: sentAttachments,
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          attachments: [],
        },
      ])
    }

    const appendToken = (token: string) => {
      setMessages((current) =>
        current.map((msg) =>
          msg.id === tempAssistantId
            ? { ...msg, content: (msg.content || "") + token }
            : msg
        )
      )
    }

    try {
      if (mode === "new") {
        const result = await streamCreateChat(
          {
            content: text || undefined,
            documentIds,
            modelId: modelId || undefined,
          },
          appendToken
        )
        notifyChatsChanged()

        const nowDate = new Date()
        const handoffMessages: ChatMessageDTO[] = [
          {
            id: tempUserId,
            role: "user",
            content: sentText,
            createdAt: now,
            attachments: sentAttachments,
          },
          {
            id: tempAssistantId,
            role: "assistant",
            content: result.content,
            createdAt: nowDate.toISOString(),
            attachments: [],
          },
        ]
        const handoffScoped: ChatScopedDocument[] = documentIds.map(
          (id, i) => {
            const fromAttach = sentAttachments.find((a) => a.id === id)
            return {
              id,
              name: fromAttach?.name ?? `Document ${i + 1}`,
              contentType: fromAttach?.contentType ?? null,
              size: fromAttach?.size ?? null,
              status: fromAttach?.status ?? "indexed",
            }
          }
        )
        const handoffChat: ChatSummary = {
          id: result.chatId,
          title: result.title || sentText?.slice(0, 60) || "New chat",
          createdAt: nowDate.toISOString(),
          updatedAt: nowDate.toISOString(),
        }
        setChatHandoff({
          chatId: result.chatId,
          chat: handoffChat,
          messages: handoffMessages,
          scopedDocuments: handoffScoped,
        })

        // replace: avoid back-stack to empty /new after first send
        router.replace(`/c/${result.chatId}`)
        // Keep busy/locked until this page unmounts after navigation
        return
      }

      if (!chatId) {
        submitLockRef.current = false
        setIsBusy(false)
        return
      }

      await streamChatMessage(
        chatId,
        {
          content: text || undefined,
          documentIds,
          modelId: modelId || undefined,
        },
        appendToken
      )

      // Reload canonical messages (real IDs from DB) + scoped docs
      const data = await getChat(chatId)
      setChat(data.chat)
      setMessages(data.messages)
      setScopedDocuments(data.scopedDocuments ?? [])
      notifyChatsChanged()
      submitLockRef.current = false
      setIsBusy(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message"
      toast.error(message)
      // Drop optimistic bubbles on failure for existing chats; keep error text if partial
      if (mode === "chat" && chatId) {
        try {
          const data = await getChat(chatId)
          setChat(data.chat)
          setMessages(data.messages)
          setScopedDocuments(data.scopedDocuments ?? [])
        } catch {
          setMessages((current) =>
            current.filter(
              (m) => m.id !== tempUserId && m.id !== tempAssistantId
            )
          )
        }
      }
      submitLockRef.current = false
      setIsBusy(false)
    }
  }

  const uploading = attachments.some((item) => item.status === "uploading")
  const readyDocs = attachments.filter(
    (item) => item.status === "ready" && item.documentId
  )
  const canSend =
    !isBusy &&
    !uploading &&
    !attachments.some((item) => item.status === "error") &&
    (Boolean(input.trim()) ||
      readyDocs.length > 0 ||
      scopedDocuments.length > 0)

  const selectedDocumentIds = new Set([
    ...scopedIds,
    ...attachments
      .filter((item) => item.documentId && item.status !== "error")
      .map((item) => item.documentId as string),
  ])

  const headerTitle =
    mode === "new" ? "New chat" : chat?.title || "Chat"

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SiteHeader title={headerTitle} />

      {loadingChat ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-6" />
          Loading chat…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport aria-label="Chat messages">
                {messages.length === 0 ? (
                  <EmptyState />
                ) : (
                  <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5 px-4 py-6">
                    {messages.map((message, index) => (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={
                          message.role === "user" &&
                          index === messages.length - 2
                        }
                      >
                        <ChatMessageRow message={message} />
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                )}
              </MessageScrollerViewport>
              {messages.length > 0 ? <MessageScrollerButton /> : null}
            </MessageScroller>
          </MessageScrollerProvider>

          <div className="border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl space-y-3">
              {mode === "new" && messages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Bubble key={suggestion} variant="outline" align="start">
                      <BubbleContent asChild className="cursor-pointer text-left">
                        <button
                          type="button"
                          onClick={() => setInput(suggestion)}
                        >
                          {suggestion}
                        </button>
                      </BubbleContent>
                    </Bubble>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border bg-card p-2 shadow-sm">
                {/* Chat-scoped docs: used for RAG on every message until unpinned */}
                {scopedDocuments.length > 0 ? (
                  <div className="space-y-1.5 px-2 pt-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      In this chat
                    </p>
                    <AttachmentGroup>
                      {scopedDocuments.map((doc) => (
                        <FileAttachmentCard
                          key={doc.id}
                          title={doc.name}
                          description={`${describeFile(doc.name, doc.size)} · ${doc.status === "indexed" ? "RAG" : doc.status}`}
                          state={
                            doc.status === "indexed"
                              ? "done"
                              : doc.status === "failed"
                                ? "error"
                                : "processing"
                          }
                          onRemove={
                            isBusy
                              ? undefined
                              : () => handleUnpinScoped(doc.id)
                          }
                        />
                      ))}
                    </AttachmentGroup>
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <AttachmentGroup className="px-2 pt-2">
                    {attachments.map((item) => (
                      <FileAttachmentCard
                        key={item.localId}
                        title={item.name}
                        description={
                          item.error
                            ? item.error
                            : item.status === "uploading"
                              ? "Uploading to RustFS…"
                              : item.source === "library"
                                ? `${describeFile(item.name, item.size)} · add to chat`
                                : describeFile(item.name, item.size)
                        }
                        state={
                          item.status === "uploading"
                            ? "uploading"
                            : item.status === "error"
                              ? "error"
                              : "done"
                        }
                        onRemove={
                          item.status === "uploading"
                            ? undefined
                            : () =>
                                setAttachments((current) =>
                                  current.filter(
                                    (row) => row.localId !== item.localId
                                  )
                                )
                        }
                      />
                    ))}
                  </AttachmentGroup>
                ) : null}

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void handleSend()
                    }
                  }}
                  rows={1}
                  disabled={isBusy}
                  placeholder={
                    isBusy
                      ? "Generating answer…"
                      : attachments.length > 0
                        ? "Ask about the selected document(s)..."
                        : "Message Documind..."
                  }
                  className={cn(
                    "max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                />

                <div className="flex items-center justify-between gap-2 px-1 pb-1">
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={DOCUMENT_ACCEPT}
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        handlePickLocalFiles(event.target.files)
                        event.target.value = ""
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Upload new document"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />
                    </Button>

                    <DropdownMenu
                      onOpenChange={(open) => {
                        if (open) void refreshLibrary()
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Select previous uploads"
                          disabled={isBusy}
                        >
                          <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72">
                        <DropdownMenuLabel>
                          {mode === "chat"
                            ? "Pin to this chat (RAG)"
                            : "Indexed documents (RAG)"}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {libraryLoading ? (
                          <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                            <Spinner className="size-3.5" />
                            Loading…
                          </p>
                        ) : library.length === 0 ? (
                          <Empty className="border-0 p-3">
                            <EmptyHeader>
                              <EmptyTitle className="text-xs">
                                No indexed documents
                              </EmptyTitle>
                              <EmptyDescription className="text-xs">
                                Upload a .txt, .md, or .csv in My documents,
                                confirm ingest, and wait until status is
                                indexed. Run npm run worker:ingest.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        ) : (
                          library.map((doc) => (
                            <DropdownMenuCheckboxItem
                              key={doc.id}
                              checked={selectedDocumentIds.has(doc.id)}
                              onCheckedChange={() =>
                                handleToggleLibraryDoc(doc)
                              }
                              onSelect={(event) => event.preventDefault()}
                              className="items-start gap-2 py-2"
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium">
                                  {doc.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {describeFile(doc.name, doc.size)} · indexed
                                </span>
                              </span>
                            </DropdownMenuCheckboxItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {models.length > 0 ? (
                      <Select
                        value={modelId}
                        onValueChange={(value) => {
                          setModelId(value)
                          try {
                            window.localStorage.setItem(
                              "documind:chat-model",
                              value
                            )
                          } catch {
                            // ignore
                          }
                        }}
                        disabled={isBusy}
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-8 w-[9.5rem] max-w-[9.5rem] min-w-0 shrink-0 gap-1 overflow-hidden border-0 bg-muted/50 px-2 shadow-none dark:bg-muted/30",
                            "[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-left"
                          )}
                          aria-label="Chat model"
                        >
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent
                          align="end"
                          position="popper"
                          className="min-w-[12rem] max-w-[16rem]"
                        >
                          {models.map((model) => (
                            <SelectItem
                              key={model.id}
                              value={model.id}
                              className="pr-8"
                              title={model.description}
                            >
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      disabled={isBusy || !canSend}
                      onClick={() => {
                        void handleSend()
                      }}
                    >
                      {uploading || isBusy ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <HugeiconsIcon
                          icon={SentIcon}
                          strokeWidth={2}
                          data-icon="inline-start"
                        />
                      )}
                      {uploading ? "Uploading…" : isBusy ? "Sending…" : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {mode === "new"
                  ? "Indexed docs you add are pinned to the new chat for every follow-up."
                  : scopedDocuments.length > 0
                    ? `RAG uses ${scopedDocuments.length} chat document${scopedDocuments.length === 1 ? "" : "s"} until you remove them.`
                    : "Pin indexed docs to this chat so every message can use them."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
