"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Database01Icon,
  Delete02Icon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

type RedisItem = {
  key: string
  fullKey: string
  type: string
  ttl: number
  value: string | null
}

export function RedisDemo() {
  const [items, setItems] = React.useState<RedisItem[]>([])
  const [prefix, setPrefix] = React.useState("documind:kv:")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  const [createKey, setCreateKey] = React.useState("")
  const [createValue, setCreateValue] = React.useState("")
  const [createTtl, setCreateTtl] = React.useState("")

  const [editKey, setEditKey] = React.useState("")
  const [editValue, setEditValue] = React.useState("")
  const [editTtl, setEditTtl] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/redis", { cache: "no-store" })
      const data = (await res.json()) as {
        error?: string
        prefix?: string
        items?: RedisItem[]
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to list keys")
      setPrefix(data.prefix ?? "documind:kv:")
      setItems(data.items ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const ttlSeconds = createTtl.trim()
        ? Number(createTtl)
        : undefined
      const res = await fetch("/api/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: createKey.trim(),
          value: createValue,
          ...(ttlSeconds && Number.isFinite(ttlSeconds) && ttlSeconds > 0
            ? { ttlSeconds }
            : {}),
        }),
      })
      const data = (await res.json()) as { error?: string; key?: string }
      if (!res.ok) throw new Error(data.error ?? "Create failed")
      toast.success(`Created ${data.key}`)
      setCreateKey("")
      setCreateValue("")
      setCreateTtl("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  const handleLoadKey = async (key: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/redis/${encodeURIComponent(key)}`, {
        cache: "no-store",
      })
      const data = (await res.json()) as {
        error?: string
        key?: string
        value?: string | null
        ttl?: number
      }
      if (!res.ok) throw new Error(data.error ?? "Read failed")
      setEditKey(data.key ?? key)
      setEditValue(data.value ?? "")
      setEditTtl(
        typeof data.ttl === "number" && data.ttl > 0 ? String(data.ttl) : ""
      )
      toast.success(`Loaded ${data.key}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Read failed")
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editKey.trim()) {
      toast.error("Select or load a key first")
      return
    }
    setBusy(true)
    try {
      const ttlSeconds = editTtl.trim() ? Number(editTtl) : undefined
      const res = await fetch(`/api/redis/${encodeURIComponent(editKey.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: editValue,
          ...(ttlSeconds && Number.isFinite(ttlSeconds) && ttlSeconds > 0
            ? { ttlSeconds }
            : {}),
        }),
      })
      const data = (await res.json()) as { error?: string; key?: string }
      if (!res.ok) throw new Error(data.error ?? "Update failed")
      toast.success(`Updated ${data.key}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (key: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/redis/${encodeURIComponent(key)}`, {
        method: "DELETE",
      })
      const data = (await res.json()) as { error?: string; key?: string }
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      toast.success(`Deleted ${data.key ?? key}`)
      if (editKey === key) {
        setEditKey("")
        setEditValue("")
        setEditTtl("")
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Redis demo</h2>
        <p className="text-sm text-muted-foreground">
          Simple CRUD against Docker Redis. Keys are namespaced under{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{prefix}</code>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create</CardTitle>
            <CardDescription>POST /api/redis</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleCreate}>
              <div className="grid gap-2">
                <Label htmlFor="redis-create-key">Key</Label>
                <Input
                  id="redis-create-key"
                  placeholder="hello"
                  value={createKey}
                  onChange={(e) => setCreateKey(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redis-create-value">Value</Label>
                <Input
                  id="redis-create-value"
                  placeholder="world"
                  value={createValue}
                  onChange={(e) => setCreateValue(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redis-create-ttl">TTL seconds (optional)</Label>
                <Input
                  id="redis-create-ttl"
                  type="number"
                  min={1}
                  placeholder="3600"
                  value={createTtl}
                  onChange={(e) => setCreateTtl(e.target.value)}
                  disabled={busy}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <HugeiconsIcon
                    icon={Add01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                )}
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Update</CardTitle>
            <CardDescription>PUT /api/redis/:key</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleUpdate}>
              <div className="grid gap-2">
                <Label htmlFor="redis-edit-key">Key</Label>
                <Input
                  id="redis-edit-key"
                  placeholder="Load from list or type key"
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redis-edit-value">Value</Label>
                <Input
                  id="redis-edit-value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redis-edit-ttl">TTL seconds (optional)</Label>
                <Input
                  id="redis-edit-ttl"
                  type="number"
                  min={1}
                  value={editTtl}
                  onChange={(e) => setEditTtl(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !editKey.trim()}
                  onClick={() => void handleLoadKey(editKey.trim())}
                >
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} data-icon="inline-start" />
                  Load
                </Button>
                <Button type="submit" disabled={busy || !editKey.trim()}>
                  Save update
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Keys</CardTitle>
            <CardDescription>GET /api/redis · DELETE /api/redis/:key</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            {loading ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Spinner className="size-6" />
              Loading keys…
            </div>
          ) : items.length === 0 ? (
            <Empty className="border border-dashed py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />
                </EmptyMedia>
                <EmptyTitle>No keys yet</EmptyTitle>
                <EmptyDescription>
                  Create a key above to verify Redis CRUD is working.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y rounded-xl border">
              {items.map((item) => (
                <li
                  key={item.fullKey}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.key}</span>
                      <Badge variant="secondary">{item.type}</Badge>
                      <Badge variant="outline">
                        TTL {item.ttl < 0 ? "none" : `${item.ttl}s`}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.value ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.fullKey}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleLoadKey(item.key)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void handleDelete(item.key)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">
            Requires a signed-in session and Redis at{" "}
            <code className="rounded bg-muted px-1">REDIS_URL</code> (default{" "}
            <code className="rounded bg-muted px-1">redis://localhost:6379</code>
            ).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
