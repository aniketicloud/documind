"use client"

import * as React from "react"

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
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Attachment01Icon,
  Cancel01Icon,
  File01Icon,
  SentIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

type ChatRole = "user" | "assistant" | "marker" | "status"

type MessageAttachment = {
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

type PendingFile = {
  id: string
  file: File
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
      "How can I help you today? Upload a document, then ask questions about refund terms, SLAs, or anything else in the file.",
    time: "10:02 AM",
  },
  {
    id: "user-upload",
    role: "user",
    content:
      "I uploaded the Q3 vendor agreement. Can you review the refund terms?",
    time: "10:03 AM",
    scrollAnchor: true,
    attachment: {
      title: "q3-vendor-agreement.pdf",
      description: "PDF · 2.4 MB",
    },
  },
  {
    id: "assistant-summary",
    role: "assistant",
    content:
      "I found the refund section on pages 8–9. Refunds are allowed within 30 days of delivery if the service fails to meet the SLAs in Schedule B. Partial refunds apply after day 15, prorated by unused term.",
    time: "10:03 AM",
  },
  {
    id: "user-followup",
    role: "user",
    content: "What about early termination fees?",
    time: "10:04 AM",
    scrollAnchor: true,
  },
  {
    id: "assistant-followup",
    role: "assistant",
    content:
      "Early termination is covered in Section 12.2. The fee is 20% of remaining contract value, waived if the vendor misses SLA for two consecutive months.",
    time: "10:04 AM",
  },
]

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key deadlines?",
  "List parties and obligations",
]

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.csv,.rtf,application/pdf,text/plain"

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtensionLabel(file: File) {
  const ext = file.name.split(".").pop()?.toUpperCase()
  return ext || "FILE"
}

function toMessageAttachment(file: File): MessageAttachment {
  return {
    title: file.name,
    description: `${fileExtensionLabel(file)} · ${formatFileSize(file.size)}`,
  }
}

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
                key={file.title}
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

function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  files,
  onAddFiles,
  onRemoveFile,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  files: PendingFile[]
  onAddFiles: (files: FileList | null) => void
  onRemoveFile: (id: string) => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  const canSend = Boolean(value.trim() || files.length > 0)

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
          {files.length > 0 ? (
            <AttachmentGroup className="px-2 pt-2">
              {files.map((pending) => (
                <FileAttachmentCard
                  key={pending.id}
                  title={pending.file.name}
                  description={`${fileExtensionLabel(pending.file)} · ${formatFileSize(pending.file.size)}`}
                  state="done"
                  onRemove={() => onRemoveFile(pending.id)}
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
              files.length > 0
                ? "Add a message about this document (optional)..."
                : "Ask anything about your document..."
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
                  onAddFiles(event.target.files)
                  // allow selecting the same file again
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Attach document"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} />
              </Button>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                PDF, DOC, TXT
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
              Send
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Demo is UI only. Attach files and send to preview the chat layout.
        </p>
      </div>
    </div>
  )
}

export function DocumindChat() {
  const [messages, setMessages] = React.useState<ChatItem[]>(INITIAL_MESSAGES)
  const [input, setInput] = React.useState("")
  const [pendingFiles, setPendingFiles] = React.useState<PendingFile[]>([])
  const [isReplying, setIsReplying] = React.useState(false)

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return

    const next = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
    }))

    setPendingFiles((current) => [...current, ...next])
  }

  const handleRemoveFile = (id: string) => {
    setPendingFiles((current) => current.filter((item) => item.id !== id))
  }

  const handleSend = () => {
    const text = input.trim()
    if ((!text && pendingFiles.length === 0) || isReplying) return

    const userId = `user-${Date.now()}`
    const assistantId = `assistant-${Date.now()}`
    const statusId = `status-${Date.now()}`
    const attachments = pendingFiles.map((item) =>
      toMessageAttachment(item.file)
    )
    const fileNames = attachments.map((file) => file.title).join(", ")

    setMessages((current) => [
      ...current.filter((item) => item.role !== "status"),
      {
        id: userId,
        role: "user",
        content: text || undefined,
        time: "Just now",
        scrollAnchor: true,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        id: statusId,
        role: "status",
        content:
          attachments.length > 0
            ? "Processing document…"
            : "Generating response…",
      },
    ])
    setInput("")
    setPendingFiles([])
    setIsReplying(true)

    window.setTimeout(() => {
      setMessages((current) => [
        ...current.filter((item) => item.id !== statusId),
        {
          id: assistantId,
          role: "assistant",
          content:
            attachments.length > 0
              ? `Got ${attachments.length === 1 ? "your document" : `${attachments.length} documents`}${fileNames ? ` (${fileNames})` : ""}. This is a placeholder reply — document parsing and chat are not wired yet.`
              : "This is a placeholder reply. Wire this composer to your document chat API when you're ready.",
          time: "Just now",
        },
      ])
      setIsReplying(false)
    }, 900)
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
        onSend={handleSend}
        disabled={isReplying}
        files={pendingFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
      />
    </div>
  )
}
