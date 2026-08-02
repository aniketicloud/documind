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
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  type MessageSource,
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
  getDocument,
  listDocuments,
  uploadDocument,
  type ListedDocument,
} from "@/lib/documents"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
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
  /** Upload pipeline: uploading → ready (stored) | error */
  status: "uploading" | "ready" | "error"
  /**
   * Server ingest status for the document row (pending/ready/processing/indexed/failed).
   * Used by the documents panel badge — never hardcode as "ready".
   */
  ingestStatus?: string
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

function formatScore(score: number) {
  if (!Number.isFinite(score)) return ""
  // Qdrant cosine scores are often 0–1; show as percent when in that range
  if (score >= 0 && score <= 1) return `${Math.round(score * 100)}%`
  return score.toFixed(2)
}

/** Citations under assistant answers — which docs/chunks grounded the reply. */
function MessageSourcesFooter({ sources }: { sources: MessageSource[] }) {
  if (sources.length === 0) return null

  return (
    <div className="mt-1 max-w-prose space-y-1.5 px-0">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Sources
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((src, i) => (
          <li key={`${src.documentId}-${src.chunkIndex}-${i}`}>
            <span
              title={
                src.snippet
                  ? `${src.documentName} · chunk ${src.chunkIndex}\n${src.snippet}`
                  : `${src.documentName} · chunk ${src.chunkIndex}`
              }
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2 py-1 text-xs text-foreground/90"
            >
              <HugeiconsIcon
                icon={File01Icon}
                strokeWidth={2}
                className="size-3 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 truncate font-medium">
                {src.documentName}
              </span>
              <span className="shrink-0 text-muted-foreground">
                §{src.chunkIndex}
              </span>
              {Number.isFinite(src.score) ? (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatScore(src.score)}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChatMessageRow({ message }: { message: ChatMessageDTO }) {
  const isUser = message.role === "user"
  const sources = !isUser && message.sources?.length ? message.sources : null

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

        {sources ? <MessageSourcesFooter sources={sources} /> : null}

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
  /** Doc IDs included in RAG for the next send (subset of chat pins / staged). */
  const [selectedForRag, setSelectedForRag] = React.useState<Set<string>>(
    () => new Set()
  )
  const [loadingChat, setLoadingChat] = React.useState(mode === "chat")
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<AttachedDocument[]>([])
  const [library, setLibrary] = React.useState<ListedDocument[]>([])
  const [libraryLoading, setLibraryLoading] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)
  const [models, setModels] = React.useState<ChatModelOption[]>([])
  const [modelId, setModelId] = React.useState<string>("")
  const [docsPanelOpen, setDocsPanelOpen] = React.useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  /** Sync lock — React state alone can't block double-clicks before re-render. */
  const submitLockRef = React.useRef(false)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("documind:docs-panel-open")
      if (stored === "0") setDocsPanelOpen(false)
      if (stored === "1") setDocsPanelOpen(true)
    } catch {
      // ignore
    }
  }, [])

  const setDocsPanelOpenPersist = (open: boolean) => {
    setDocsPanelOpen(open)
    try {
      window.localStorage.setItem(
        "documind:docs-panel-open",
        open ? "1" : "0"
      )
    } catch {
      // ignore
    }
  }

  const scopedIds = React.useMemo(
    () => new Set(scopedDocuments.map((d) => d.id)),
    [scopedDocuments]
  )

  const prevPinnedIdsRef = React.useRef<Set<string>>(new Set())

  // Drop selection for unpinned docs; auto-select only *newly* pinned docs
  React.useEffect(() => {
    const pinnedIds = new Set(scopedDocuments.map((d) => d.id))
    const prevPinned = prevPinnedIdsRef.current
    setSelectedForRag((prev) => {
      const next = new Set<string>()
      for (const id of pinnedIds) {
        if (prev.has(id)) {
          next.add(id) // keep user choice (selected)
        } else if (!prevPinned.has(id)) {
          next.add(id) // brand-new pin → selected by default
        }
        // else: was pinned, user had deselected (not in prev) → stay deselected
      }
      return next
    })
    prevPinnedIdsRef.current = pinnedIds
  }, [scopedDocuments])

  const isTerminalIngest = (status?: string) =>
    status === "indexed" || status === "failed"

  // Existing chat: poll scoped pins until all terminal
  React.useEffect(() => {
    if (mode !== "chat" || !chatId) return
    const pending = scopedDocuments.some((d) => !isTerminalIngest(d.status))
    if (!pending) return
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const data = await getChat(chatId)
          setScopedDocuments(data.scopedDocuments ?? [])
        } catch {
          // ignore poll errors
        }
      })()
    }, 2500)
    return () => window.clearInterval(t)
  }, [mode, chatId, scopedDocuments])

  // Staged uploads (usually /new): poll real ingest status until indexed/failed
  const pendingStagedIdsKey = React.useMemo(() => {
    return attachments
      .filter(
        (a) =>
          a.documentId &&
          a.status === "ready" &&
          !isTerminalIngest(a.ingestStatus)
      )
      .map((a) => a.documentId as string)
      .sort()
      .join(",")
  }, [attachments])

  React.useEffect(() => {
    if (!pendingStagedIdsKey) return
    const pendingIds = pendingStagedIdsKey.split(",").filter(Boolean)
    if (pendingIds.length === 0) return

    let cancelled = false
    const pollOnce = async () => {
      await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const doc = await getDocument(id)
            if (cancelled) return
            setAttachments((current) => {
              let changed = false
              const next = current.map((item) => {
                if (item.documentId !== id) return item
                if (
                  item.ingestStatus === doc.status &&
                  item.name === doc.name &&
                  (item.size ?? null) === (doc.size ?? null)
                ) {
                  return item
                }
                changed = true
                return {
                  ...item,
                  name: doc.name,
                  size: doc.size ?? item.size,
                  ingestStatus: doc.status,
                  error:
                    doc.status === "failed"
                      ? doc.errorMessage || item.error
                      : item.error,
                }
              })
              return changed ? next : current
            })
          } catch {
            // ignore single-doc poll errors
          }
        })
      )
    }

    void pollOnce()
    const t = window.setInterval(() => {
      void pollOnce()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [pendingStagedIdsKey])

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
                    ingestStatus: doc.status || "processing",
                    error: undefined,
                  }
                : item
            )
          )
          toast.success(`${doc.name} uploaded`)
          void refreshLibrary()
          // Existing chat: pin to chat panel (any status); user selects for RAG
          if (mode === "chat" && chatId) {
            try {
              const { documents: next } = await pinChatDocuments(chatId, [
                doc.id,
              ])
              setScopedDocuments(next)
              setAttachments((current) =>
                current.filter((item) => item.localId !== localId)
              )
            } catch {
              // keep in composer attachments; pin on send
            }
          } else {
            // New chat: staged attachment auto-selected for first send
            setSelectedForRag((prev) => new Set(prev).add(doc.id))
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
    // Existing chat: pin/unpin in chat document panel
    if (mode === "chat" && chatId) {
      if (scopedIds.has(doc.id)) {
        void (async () => {
          try {
            const { documents: next } = await unpinChatDocument(chatId, doc.id)
            setScopedDocuments(next)
            setSelectedForRag((prev) => {
              const n = new Set(prev)
              n.delete(doc.id)
              return n
            })
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to remove"
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
          toast.error(error instanceof Error ? error.message : "Failed to add")
        }
      })()
      return
    }

    // New chat: stage until first send
    setAttachments((current) => {
      const exists = current.some((item) => item.documentId === doc.id)
      if (exists) {
        setSelectedForRag((prev) => {
          const n = new Set(prev)
          n.delete(doc.id)
          return n
        })
        return current.filter((item) => item.documentId !== doc.id)
      }
      setSelectedForRag((prev) => new Set(prev).add(doc.id))
      return [
        ...current,
        {
          localId: crypto.randomUUID(),
          documentId: doc.id,
          name: doc.name,
          size: doc.size,
          status: "ready",
          ingestStatus: doc.status || "indexed",
          source: "library",
        },
      ]
    })
  }

  const handleUnpinScoped = (documentId: string) => {
    if (mode === "new") {
      setAttachments((current) =>
        current.filter((item) => item.documentId !== documentId)
      )
      setSelectedForRag((prev) => {
        const n = new Set(prev)
        n.delete(documentId)
        return n
      })
      return
    }
    if (!chatId) return
    void (async () => {
      try {
        const { documents: next } = await unpinChatDocument(chatId, documentId)
        setScopedDocuments(next)
        setSelectedForRag((prev) => {
          const n = new Set(prev)
          n.delete(documentId)
          return n
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove")
      }
    })()
  }

  const toggleRagSelection = (documentId: string, checked: boolean) => {
    setSelectedForRag((prev) => {
      const next = new Set(prev)
      if (checked) next.add(documentId)
      else next.delete(documentId)
      return next
    })
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
    // Selection for RAG + any staged ready uploads not yet in selection
    const selectedIds = [...selectedForRag]
    const stagedReadyIds = readyDocs
      .map((d) => d.documentId as string)
      .filter(Boolean)
    // Prefer explicit RAG selection; on new chat also include staged selected
    let documentIds =
      mode === "new"
        ? stagedReadyIds.filter((id) => selectedForRag.has(id))
        : selectedIds

    // If user only has staged uploads selected via attachments on new chat
    if (mode === "new" && documentIds.length === 0 && selectedForRag.size > 0) {
      documentIds = stagedReadyIds.filter((id) => selectedForRag.has(id))
    }

    if (
      !text &&
      documentIds.length === 0 &&
      scopedDocuments.length === 0 &&
      readyDocs.length === 0
    ) {
      return
    }

    // Allow send with text only (empty documentIds → general chat)
    if (!text && documentIds.length === 0) {
      toast.message("Select at least one document for RAG, or type a message")
      return
    }

    submitLockRef.current = true
    setIsBusy(true)
    const sentText = text || null
    const panelDocs =
      mode === "chat"
        ? scopedDocuments.filter((d) => selectedForRag.has(d.id))
        : readyDocs
            .filter((d) => d.documentId && selectedForRag.has(d.documentId))
            .map((d) => ({
              id: d.documentId as string,
              name: d.name,
              contentType: null as string | null,
              size: d.size ?? null,
              status: d.ingestStatus || "processing",
            }))
    const sentAttachments = panelDocs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      contentType:
        "contentType" in doc
          ? ((doc as ChatScopedDocument).contentType ?? null)
          : null,
      size: doc.size ?? null,
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
          sources: null,
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          attachments: [],
          sources: null,
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
          sources: null,
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          attachments: [],
          sources: null,
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

        // Canonical messages include sources footer + real IDs
        let handoffMessages: ChatMessageDTO[]
        let handoffScoped: ChatScopedDocument[]
        let handoffChat: ChatSummary
        try {
          const data = await getChat(result.chatId)
          handoffChat = data.chat
          handoffMessages = data.messages
          handoffScoped = data.scopedDocuments ?? []
        } catch {
          const nowDate = new Date()
          handoffMessages = [
            {
              id: tempUserId,
              role: "user",
              content: sentText,
              createdAt: now,
              attachments: sentAttachments,
              sources: null,
            },
            {
              id: tempAssistantId,
              role: "assistant",
              content: result.content,
              createdAt: nowDate.toISOString(),
              attachments: [],
              sources: null,
            },
          ]
          handoffScoped = documentIds.map((id, i) => {
            const fromAttach = sentAttachments.find((a) => a.id === id)
            return {
              id,
              name: fromAttach?.name ?? `Document ${i + 1}`,
              contentType: fromAttach?.contentType ?? null,
              size: fromAttach?.size ?? null,
              status: fromAttach?.status ?? "indexed",
            }
          })
          handoffChat = {
            id: result.chatId,
            title: result.title || sentText?.slice(0, 60) || "New chat",
            createdAt: nowDate.toISOString(),
            updatedAt: nowDate.toISOString(),
          }
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
  const selectedRagCount = selectedForRag.size
  const canSend =
    !isBusy &&
    !uploading &&
    !attachments.some((item) => item.status === "error") &&
    (Boolean(input.trim()) || selectedRagCount > 0)

  // Library checkmarks: pinned (chat) or staged (new)
  const selectedDocumentIds = new Set([
    ...scopedIds,
    ...attachments
      .filter((item) => item.documentId && item.status !== "error")
      .map((item) => item.documentId as string),
  ])

  /** Unified list for the documents panel (chat pins or new-chat staging). */
  type PanelDoc = {
    id: string
    name: string
    size?: number | null
    status: string
    selectable: boolean
  }

  const panelDocuments: PanelDoc[] =
    mode === "chat"
      ? scopedDocuments.map((d) => ({
          id: d.id,
          name: d.name,
          size: d.size,
          status: d.status,
          selectable: true,
        }))
      : [
          ...readyDocs
            .filter((d) => d.documentId)
            .map((d) => ({
              id: d.documentId as string,
              name: d.name,
              size: d.size,
              // Real server status (polled); never hardcode "ready"
              status: d.ingestStatus || "processing",
              selectable: true,
            })),
          ...attachments
            .filter((d) => d.status === "uploading")
            .map((d) => ({
              id: d.localId,
              name: d.name,
              size: d.size,
              status: "uploading",
              selectable: false,
            })),
          ...attachments
            .filter((d) => d.status === "error")
            .map((d) => ({
              id: d.localId,
              name: d.name,
              size: d.size,
              status: "failed",
              selectable: false,
            })),
        ]

  const statusLabel = (status: string) => {
    if (status === "indexed") return "Indexed"
    if (status === "failed") return "Failed"
    if (status === "uploading") return "Uploading…"
    if (status === "processing" || status === "ready" || status === "pending")
      return "Processing…"
    return status
  }

  const statusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "indexed") return "default"
    if (status === "failed") return "destructive"
    if (status === "uploading" || status === "processing" || status === "ready")
      return "secondary"
    return "outline"
  }

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
          {/* Collapsible chat documents panel */}
          {panelDocuments.length > 0 ? (
            <div className="shrink-0 border-b bg-muted/30">
              <div className="mx-auto w-full max-w-3xl px-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={docsPanelOpen}
                  onClick={() => setDocsPanelOpenPersist(!docsPanelOpen)}
                >
                  <span className="min-w-0 truncate">
                    Documents in this chat
                    <span className="font-normal">
                      {" "}
                      · {panelDocuments.length} file
                      {panelDocuments.length === 1 ? "" : "s"}
                      {selectedRagCount > 0
                        ? ` · ${selectedRagCount} selected`
                        : " · none selected"}
                    </span>
                  </span>
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/25"
                    aria-hidden
                  >
                    <HugeiconsIcon
                      icon={docsPanelOpen ? ArrowUp01Icon : ArrowDown01Icon}
                      strokeWidth={2.5}
                      className="size-3.5"
                    />
                  </span>
                </button>

                {docsPanelOpen ? (
                  <div className="space-y-2 pb-2.5">
                    <ul className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
                      {panelDocuments.map((doc) => {
                        const checked = selectedForRag.has(doc.id)
                        const canToggle =
                          doc.selectable && doc.status !== "uploading"
                        return (
                          <li
                            key={doc.id}
                            className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm"
                          >
                            <Checkbox
                              checked={canToggle ? checked : false}
                              disabled={!canToggle || isBusy}
                              onCheckedChange={(value) => {
                                if (!canToggle || !doc.id) return
                                toggleRagSelection(doc.id, value === true)
                              }}
                              aria-label={`Use ${doc.name} for answers`}
                            />
                            <HugeiconsIcon
                              icon={File01Icon}
                              strokeWidth={2}
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{doc.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {describeFile(doc.name, doc.size)}
                              </p>
                            </div>
                            <Badge variant={statusVariant(doc.status)}>
                              {statusLabel(doc.status)}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0"
                              disabled={isBusy || doc.status === "uploading"}
                              aria-label={`Remove ${doc.name} from chat`}
                              onClick={() => {
                                if (mode === "new" && !scopedIds.has(doc.id)) {
                                  setAttachments((current) =>
                                    current.filter(
                                      (row) =>
                                        row.localId !== doc.id &&
                                        row.documentId !== doc.id
                                    )
                                  )
                                  setSelectedForRag((prev) => {
                                    const n = new Set(prev)
                                    n.delete(doc.id)
                                    return n
                                  })
                                  return
                                }
                                handleUnpinScoped(doc.id)
                              }}
                            >
                              <HugeiconsIcon
                                icon={Cancel01Icon}
                                strokeWidth={2}
                                className="size-3.5"
                              />
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="text-[11px] text-muted-foreground">
                      Check a file to use it in the next answer. Only{" "}
                      <strong className="font-medium">Indexed</strong> files
                      contribute to RAG. Remove deletes it from this chat only.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

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
                      : selectedRagCount > 0
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
                            ? "Add to this chat"
                            : "Add documents"}
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
                                Upload a .txt, .md, .csv, .docx, or PDF
                                in My documents and wait until status is
                                indexed (docker compose must be running).
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
                            "h-8 w-38 max-w-38 min-w-0 shrink-0 gap-1 overflow-hidden border-0 bg-muted/50 px-2 shadow-none dark:bg-muted/30",
                            "**:data-[slot=select-value]:min-w-0 **:data-[slot=select-value]:flex-1 **:data-[slot=select-value]:truncate **:data-[slot=select-value]:text-left"
                          )}
                          aria-label="Chat model"
                        >
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent
                          align="end"
                          position="popper"
                          className="min-w-48 max-w-64"
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
                {panelDocuments.length > 0
                  ? "Select documents above for this answer. Deselect to ignore; remove to drop from the chat."
                  : "Add files with the paperclip or folder — they appear above the messages."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
