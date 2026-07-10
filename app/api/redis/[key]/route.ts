import { NextResponse } from "next/server"

import {
  ensureRedisConnected,
  fromRedisKey,
  toRedisKey,
} from "@/lib/redis"
import { requireSession } from "@/lib/session"

type RouteContext = {
  params: Promise<{ key: string }>
}

function decodeKeyParam(raw: string) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** GET /api/redis/:key */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { key: raw } = await context.params
    const fullKey = toRedisKey(decodeKeyParam(raw))
    const redis = await ensureRedisConnected()

    const exists = await redis.exists(fullKey)
    if (!exists) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }

    const type = await redis.type(fullKey)
    if (type !== "string") {
      return NextResponse.json(
        { error: `Unsupported Redis type: ${type}. Only string is supported.` },
        { status: 400 }
      )
    }

    const value = await redis.get(fullKey)
    const ttl = await redis.ttl(fullKey)

    return NextResponse.json({
      key: fromRedisKey(fullKey),
      fullKey,
      type,
      value,
      ttl,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read Redis key"
    const status = message.includes("required") || message.includes("chars")
      ? 400
      : 500
    if (status === 500) console.error("[redis/:key GET]", error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PUT /api/redis/:key
 * Body: { value: string, ttlSeconds?: number | null }
 * ttlSeconds null/omitted keeps existing TTL behavior: overwrite without EX removes TTL unless set.
 */
export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { value?: string; ttlSeconds?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    if (typeof body.value !== "string") {
      return NextResponse.json(
        { error: "value must be a string" },
        { status: 400 }
      )
    }

    const { key: raw } = await context.params
    const fullKey = toRedisKey(decodeKeyParam(raw))
    const redis = await ensureRedisConnected()

    const exists = await redis.exists(fullKey)
    if (!exists) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }

    const ttl =
      typeof body.ttlSeconds === "number" &&
      Number.isFinite(body.ttlSeconds) &&
      body.ttlSeconds > 0
        ? Math.floor(body.ttlSeconds)
        : null

    if (ttl) {
      await redis.set(fullKey, body.value, "EX", ttl)
    } else {
      await redis.set(fullKey, body.value)
    }

    return NextResponse.json({
      key: fromRedisKey(fullKey),
      fullKey,
      value: body.value,
      ttl: ttl ?? (await redis.ttl(fullKey)),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update Redis key"
    const status = message.includes("required") || message.includes("chars")
      ? 400
      : 500
    if (status === 500) console.error("[redis/:key PUT]", error)
    return NextResponse.json({ error: message }, { status })
  }
}

/** DELETE /api/redis/:key */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { key: raw } = await context.params
    const fullKey = toRedisKey(decodeKeyParam(raw))
    const redis = await ensureRedisConnected()

    const removed = await redis.del(fullKey)
    if (!removed) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      key: fromRedisKey(fullKey),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete Redis key"
    const status = message.includes("required") || message.includes("chars")
      ? 400
      : 500
    if (status === 500) console.error("[redis/:key DELETE]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
