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
  createChat,
  getChat,
  sendChatMessage,
  type ChatMessageDTO,
  type ChatSummary,
} from "@/lib/chat-client"
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

        {message.content ? (
          <Bubble
            variant={isUser ? "default" : "ghost"}
            align={isUser ? "end" : "start"}
          >
            <BubbleContent>{message.content}</BubbleContent>
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
            Start a new chat by sending a message or uploading a document. Your
            conversation will appear in Recent on the left.
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
  const [loadingChat, setLoadingChat] = React.useState(mode === "chat")
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<AttachedDocument[]>([])
  const [library, setLibrary] = React.useState<ListedDocument[]>([])
  const [libraryLoading, setLibraryLoading] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  /** Sync lock — React state alone can't block double-clicks before re-render. */
  const submitLockRef = React.useRef(false)

  const refreshLibrary = React.useCallback(async () => {
    setLibraryLoading(true)
    try {
      const rows = await listDocuments({ status: "ready" })
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
      setLoadingChat(false)
      return
    }

    let cancelled = false
    setLoadingChat(true)

    void (async () => {
      try {
        const data = await getChat(chatId)
        if (cancelled) return
        setChat(data.chat)
        setMessages(data.messages)
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
    if (!text && readyDocs.length === 0) return

    submitLockRef.current = true
    setIsBusy(true)
    const documentIds = readyDocs.map((doc) => doc.documentId as string)

    // Clear composer immediately so a second Send has nothing to submit
    if (mode === "new") {
      setInput("")
      setAttachments([])
    }

    try {
      if (mode === "new") {
        const result = await createChat({
          content: text || undefined,
          documentIds,
        })
        notifyChatsChanged()
        router.push(`/c/${result.chat.id}`)
        // Keep busy/locked until this page unmounts after navigation
        return
      }

      if (!chatId) {
        submitLockRef.current = false
        setIsBusy(false)
        return
      }

      const result = await sendChatMessage(chatId, {
        content: text || undefined,
        documentIds,
      })
      setChat(result.chat)
      setMessages(result.messages)
      setInput("")
      setAttachments([])
      notifyChatsChanged()
      submitLockRef.current = false
      setIsBusy(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message"
      toast.error(message)
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
    (Boolean(input.trim()) || readyDocs.length > 0)

  const selectedDocumentIds = new Set(
    attachments
      .filter((item) => item.documentId && item.status !== "error")
      .map((item) => item.documentId as string)
  )

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
                {mode === "new" || messages.length === 0 ? (
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
              {mode === "new" ? (
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
                                ? `${describeFile(item.name, item.size)} · library`
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
                    isBusy && mode === "new"
                      ? "Creating chat…"
                      : attachments.length > 0
                        ? "Ask about the selected document(s)..."
                        : "Message Documind..."
                  }
                  className={cn(
                    "max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                />

                <div className="flex items-center justify-between gap-2 px-1 pb-1">
                  <div className="flex items-center gap-1">
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
                          Your uploaded files
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
                                No documents yet
                              </EmptyTitle>
                              <EmptyDescription className="text-xs">
                                Upload a PDF, Word, Excel, or text file to use
                                it here.
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
                                  {describeFile(doc.name, doc.size)}
                                </span>
                              </span>
                            </DropdownMenuCheckboxItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button
                    type="button"
                    size="sm"
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
              <p className="text-center text-xs text-muted-foreground">
                {mode === "new"
                  ? "Send a message or file to create a chat in Recent."
                  : "Files upload immediately. AI answers are placeholders for now."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
