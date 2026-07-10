"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  deleteChat,
  listChats,
  renameChat,
  type ChatSummary,
} from "@/lib/chat-client"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Edit01Icon,
  Message01Icon,
  MoreHorizontalCircle01Icon,
} from "@hugeicons/core-free-icons"

export function ChatHistory() {
  const pathname = usePathname()
  const router = useRouter()
  const [chats, setChats] = React.useState<ChatSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [chatToDelete, setChatToDelete] = React.useState<ChatSummary | null>(
    null
  )
  const [chatToRename, setChatToRename] = React.useState<ChatSummary | null>(
    null
  )
  const [renameValue, setRenameValue] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)
  const [renaming, setRenaming] = React.useState(false)
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    try {
      const rows = await listChats()
      setChats(rows)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load chats"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load, pathname])

  React.useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener("documind:chats-changed", onRefresh)
    return () => window.removeEventListener("documind:chats-changed", onRefresh)
  }, [load])

  React.useEffect(() => {
    if (chatToRename) {
      // Focus after dialog opens
      const id = window.setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 50)
      return () => window.clearTimeout(id)
    }
  }, [chatToRename])

  const activeChatId = pathname.startsWith("/c/")
    ? pathname.slice(3).split("/")[0]
    : null

  const openRename = (chat: ChatSummary) => {
    setChatToRename(chat)
    setRenameValue(chat.title)
  }

  const handleConfirmRename = async () => {
    if (!chatToRename) return
    const title = renameValue.trim()
    if (!title) {
      toast.error("Title is required")
      return
    }

    setRenaming(true)
    try {
      const { chat } = await renameChat(chatToRename.id, title)
      setChats((current) =>
        current.map((item) =>
          item.id === chat.id
            ? { ...item, title: chat.title, updatedAt: chat.updatedAt }
            : item
        )
      )
      setChatToRename(null)
      toast.success("Chat renamed")
      notifyChatRenamed({ id: chat.id, title: chat.title })
      notifyChatsChanged()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename chat"
      toast.error(message)
    } finally {
      setRenaming(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return
    setDeleting(true)
    try {
      await deleteChat(chatToDelete.id)
      setChats((current) =>
        current.filter((chat) => chat.id !== chatToDelete.id)
      )
      setChatToDelete(null)
      toast.success("Chat deleted")
      if (activeChatId === chatToDelete.id) {
        router.push("/new")
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete chat"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Recent</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {loading ? (
              <SidebarMenuItem>
                <span className="px-2 text-xs text-muted-foreground">
                  Loading…
                </span>
              </SidebarMenuItem>
            ) : chats.length === 0 ? (
              <SidebarMenuItem>
                <span className="px-2 text-xs text-muted-foreground">
                  No chats yet
                </span>
              </SidebarMenuItem>
            ) : (
              chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeChatId === chat.id}
                    tooltip={chat.title}
                  >
                    <Link href={`/c/${chat.id}`}>
                      <HugeiconsIcon icon={Message01Icon} strokeWidth={2} />
                      <span className="truncate">{chat.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <HugeiconsIcon
                          icon={MoreHorizontalCircle01Icon}
                          strokeWidth={2}
                        />
                        <span className="sr-only">Chat actions</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem onClick={() => openRename(chat)}>
                        <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setChatToDelete(chat)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog
        open={chatToRename !== null}
        onOpenChange={(open) => {
          if (!open && !renaming) setChatToRename(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Rename chat</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a name for this conversation. It only appears in your
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="chat-rename-title">Title</Label>
            <Input
              ref={renameInputRef}
              id="chat-rename-title"
              value={renameValue}
              maxLength={120}
              disabled={renaming}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleConfirmRename()
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renaming}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={renaming || !renameValue.trim()}
              onClick={() => {
                void handleConfirmRename()
              }}
            >
              {renaming ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={chatToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setChatToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {chatToDelete ? (
                <>
                  Delete{" "}
                  <span className="font-medium text-foreground">
                    {chatToDelete.title}
                  </span>
                  ? Messages in this chat will be removed. Uploaded files stay in
                  My documents.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function notifyChatsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("documind:chats-changed"))
  }
}

export function notifyChatRenamed(chat: { id: string; title: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("documind:chat-renamed", { detail: chat })
    )
  }
}
