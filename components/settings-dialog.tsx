"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout01Icon,
  Settings05Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons"

type SettingsSection = "general" | "account"

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: typeof Settings05Icon
}[] = [
  { id: "general", label: "General", icon: Settings05Icon },
  { id: "account", label: "Account", icon: UserCircle02Icon },
]

export function SettingsDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    name: string
    email: string
  }
}) {
  const router = useRouter()
  const [section, setSection] = React.useState<SettingsSection>("general")
  const [isPending, startTransition] = useTransition()

  React.useEffect(() => {
    if (open) setSection("general")
  }, [open])

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut()
      onOpenChange(false)
      router.push("/login")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(560px,85vh)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <div className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account and general preferences.
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left nav — Claude-style settings sidebar */}
          <aside className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3 sm:w-52">
            <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Settings
            </p>
            <nav className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      strokeWidth={2}
                      className="size-4 shrink-0"
                    />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Right content panel */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {section === "general" ? (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">
                    General
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Your profile details for this account.
                  </p>
                </div>
                <Separator />
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="settings-name">Name</Label>
                    <Input
                      id="settings-name"
                      value={user.name}
                      readOnly
                      className="bg-muted/40"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="settings-email">Email</Label>
                    <Input
                      id="settings-email"
                      type="email"
                      value={user.email}
                      readOnly
                      className="bg-muted/40"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Name and email are read-only for now.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">
                    Account
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sign out of Documind on this device.
                  </p>
                </div>
                <Separator />
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Log out</p>
                      <p className="text-xs text-muted-foreground">
                        You can sign back in anytime with your email and
                        password.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={handleSignOut}
                      className="shrink-0"
                    >
                      {isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <HugeiconsIcon
                          icon={Logout01Icon}
                          strokeWidth={2}
                          data-icon="inline-start"
                        />
                      )}
                      {isPending ? "Signing out…" : "Log out"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
