"use client"

import * as React from "react"
import { toast } from "sonner"

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

type ChatRole = "user" | "assistant" | "marker" | "status"

type MessageAttachment = {
  documentId?: string
  title: string
  description: string
}

type ChatItem = {
  id: string
  role: ChatRole
  content?: string
  time?: string
  scrollAnchor?: boolean
  attachment?: MessageAttachment
  attachments?: MessageAttachment[]
}

/** Files attached to the composer — upload happens immediately on pick. */
type AttachedDocument = {
  localId: string
  documentId?: string
  name: string
  size?: number | null
  status: "uploading" | "ready" | "error"
  error?: string
  source: "upload" | "library"
}

const INITIAL_MESSAGES: ChatItem[] = [
  {
    id: "marker-today",
    role: "marker",
    content: "Today",
  },
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "How can I help you today? Attach a new file (uploads to RustFS right away) or pick one you already uploaded.",
    time: "10:02 AM",
  },
]

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key deadlines?",
  "List parties and obligations",
]

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.csv,.rtf,application/pdf,text/plain"

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

function ChatMessageItem({ item }: { item: ChatItem }) {
  if (item.role === "marker") {
    return (
      <Marker variant="separator">
        <MarkerContent>{item.content}</MarkerContent>
      </Marker>
    )
  }

  if (item.role === "status") {
    return (
      <Marker role="status">
        <MarkerIcon>
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
        </MarkerIcon>
        <MarkerContent className="shimmer">{item.content}</MarkerContent>
      </Marker>
    )
  }

  const isUser = item.role === "user"
  const attachments =
    item.attachments ?? (item.attachment ? [item.attachment] : [])

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageAvatar>
        {isUser ? <UserAvatar /> : <AssistantAvatar />}
      </MessageAvatar>
      <MessageContent>
        {!isUser ? <MessageHeader>Documind</MessageHeader> : null}

        {attachments.length > 0 ? (
          <AttachmentGroup>
            {attachments.map((file) => (
              <FileAttachmentCard
                key={file.documentId ?? file.title}
                title={file.title}
                description={file.description}
              />
            ))}
          </AttachmentGroup>
        ) : null}

        {item.content ? (
          <Bubble
            variant={isUser ? "default" : "ghost"}
            align={isUser ? "end" : "start"}
          >
            <BubbleContent>{item.content}</BubbleContent>
          </Bubble>
        ) : null}

        {item.time ? <MessageFooter>{item.time}</MessageFooter> : null}
      </MessageContent>
    </Message>
  )
}

function LibraryPicker({
  library,
  selectedIds,
  loading,
  disabled,
  onToggle,
  onRefresh,
}: {
  library: ListedDocument[]
  selectedIds: Set<string>
  loading: boolean
  disabled?: boolean
  onToggle: (doc: ListedDocument) => void
  onRefresh: () => void
}) {
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onRefresh()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Select previous uploads"
          disabled={disabled}
        >
          <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Your uploaded files</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : library.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No ready documents yet. Attach a new file to upload one.
          </p>
        ) : (
          library.map((doc) => (
            <DropdownMenuCheckboxItem
              key={doc.id}
              checked={selectedIds.has(doc.id)}
              onCheckedChange={() => onToggle(doc)}
              onSelect={(event) => event.preventDefault()}
              className="items-start gap-2 py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{doc.name}</span>
                <span className="text-xs text-muted-foreground">
                  {describeFile(doc.name, doc.size)}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  attachments,
  library,
  libraryLoading,
  onPickLocalFiles,
  onToggleLibraryDoc,
  onRemoveAttachment,
  onRefreshLibrary,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  attachments: AttachedDocument[]
  library: ListedDocument[]
  libraryLoading: boolean
  onPickLocalFiles: (files: FileList | null) => void
  onToggleLibraryDoc: (doc: ListedDocument) => void
  onRemoveAttachment: (localId: string) => void
  onRefreshLibrary: () => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  const uploading = attachments.some((item) => item.status === "uploading")
  const readyDocs = attachments.filter(
    (item) => item.status === "ready" && item.documentId
  )
  const hasErrors = attachments.some((item) => item.status === "error")
  const canSend =
    !uploading &&
    !hasErrors &&
    (Boolean(value.trim()) || readyDocs.length > 0)

  // Any attached ready doc counts as selected in the library list
  // (including ones just uploaded via paperclip, not only library picks)
  const selectedDocumentIds = new Set(
    attachments
      .filter((item) => item.documentId && item.status !== "error")
      .map((item) => item.documentId as string)
  )

  return (
    <div className="border-t bg-background p-4">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <Bubble key={suggestion} variant="outline" align="start">
              <BubbleContent asChild className="cursor-pointer text-left">
                <button type="button" onClick={() => onChange(suggestion)}>
                  {suggestion}
                </button>
              </BubbleContent>
            </Bubble>
          ))}
        </div>

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
                      : () => onRemoveAttachment(item.localId)
                  }
                />
              ))}
            </AttachmentGroup>
          ) : null}

          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              attachments.length > 0
                ? "Ask about the selected document(s)..."
                : "Ask anything, or attach a document..."
            }
            className={cn(
              "max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            )}
          />

          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="sr-only"
                onChange={(event) => {
                  onPickLocalFiles(event.target.files)
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Upload new document"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />
              </Button>
              <LibraryPicker
                library={library}
                selectedIds={selectedDocumentIds}
                loading={libraryLoading}
                disabled={disabled}
                onToggle={onToggleLibraryDoc}
                onRefresh={onRefreshLibrary}
              />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Upload now · or pick previous
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={disabled || !canSend}
              onClick={onSend}
              aria-label="Send message"
            >
              <HugeiconsIcon
                icon={SentIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              {uploading ? "Uploading…" : "Send"}
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          New files upload immediately to RustFS. Library only shows your own
          ready documents.
        </p>
      </div>
    </div>
  )
}

export function DocumindChat() {
  const [messages, setMessages] = React.useState<ChatItem[]>(INITIAL_MESSAGES)
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<AttachedDocument[]>([])
  const [library, setLibrary] = React.useState<ListedDocument[]>([])
  const [libraryLoading, setLibraryLoading] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)

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

  /** Upload as soon as the user picks local files (not on Send). */
  const handlePickLocalFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return

    const files = Array.from(fileList)

    for (const file of files) {
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
          status: "ready" as const,
          source: "library" as const,
        },
      ]
    })
  }

  const handleRemoveAttachment = (localId: string) => {
    setAttachments((current) =>
      current.filter((item) => item.localId !== localId)
    )
  }

  const handleSend = async () => {
    const text = input.trim()
    const readyDocs = attachments.filter(
      (item) => item.status === "ready" && item.documentId
    )

    if (isBusy) return
    if (attachments.some((item) => item.status === "uploading")) {
      toast.message("Wait for uploads to finish")
      return
    }
    if (attachments.some((item) => item.status === "error")) {
      toast.error("Remove failed uploads before sending")
      return
    }
    if (!text && readyDocs.length === 0) return

    setIsBusy(true)

    const messageAttachments: MessageAttachment[] = readyDocs.map((doc) => ({
      documentId: doc.documentId,
      title: doc.name,
      description: describeFile(doc.name, doc.size),
    }))

    const userId = `user-${Date.now()}`
    const statusId = `status-${Date.now()}`

    setMessages((current) => [
      ...current.filter((item) => item.role !== "status"),
      {
        id: userId,
        role: "user",
        content: text || undefined,
        time: "Just now",
        scrollAnchor: true,
        attachments:
          messageAttachments.length > 0 ? messageAttachments : undefined,
      },
      {
        id: statusId,
        role: "status",
        content:
          readyDocs.length > 0
            ? "Using your document(s). Preparing answer…"
            : "Generating response…",
      },
    ])
    setInput("")
    setAttachments([])

    window.setTimeout(() => {
      const names = readyDocs.map((doc) => doc.name).join(", ")
      setMessages((current) => [
        ...current.filter((item) => item.id !== statusId),
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            readyDocs.length > 0
              ? `Using ${readyDocs.length === 1 ? "document" : `${readyDocs.length} documents`}${names ? ` (${names})` : ""}. Files are already stored in RustFS. Chat over document contents is not implemented yet.`
              : "This is a placeholder reply. Document Q&A is not wired yet.",
          time: "Just now",
        },
      ])
      setIsBusy(false)
    }, 700)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Document chat messages">
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5 px-4 py-6">
              {messages.map((item) => (
                <MessageScrollerItem
                  key={item.id}
                  messageId={item.id}
                  scrollAnchor={item.scrollAnchor}
                >
                  <ChatMessageItem item={item} />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={() => {
          void handleSend()
        }}
        disabled={isBusy}
        attachments={attachments}
        library={library}
        libraryLoading={libraryLoading}
        onPickLocalFiles={handlePickLocalFiles}
        onToggleLibraryDoc={handleToggleLibraryDoc}
        onRemoveAttachment={handleRemoveAttachment}
        onRefreshLibrary={() => {
          void refreshLibrary()
        }}
      />
    </div>
  )
}
