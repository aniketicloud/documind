import { NextResponse } from "next/server"

import {
  ensureRedisConnected,
  fromRedisKey,
  getKeyPrefix,
  toRedisKey,
} from "@/lib/redis"
import { requireSession } from "@/lib/session"

/**
 * GET /api/redis
 * Lists test keys under documind:kv:* (optional ?pattern= substring)
 */
export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const redis = await ensureRedisConnected()
    const { searchParams } = new URL(request.url)
    const pattern = searchParams.get("pattern")?.trim()
    const match = pattern
      ? `${getKeyPrefix()}*${pattern}*`
      : `${getKeyPrefix()}*`

    const keys: string[] = []
    let cursor = "0"
    do {
      const [next, batch] = await redis.scan(
        cursor,
        "MATCH",
        match,
        "COUNT",
        100
      )
      cursor = next
      keys.push(...batch)
    } while (cursor !== "0")

    keys.sort()

    const items = await Promise.all(
      keys.map(async (fullKey) => {
        const type = await redis.type(fullKey)
        const ttl = await redis.ttl(fullKey)
        let value: string | null = null
        if (type === "string") {
          value = await redis.get(fullKey)
        }
        return {
          key: fromRedisKey(fullKey),
          fullKey,
          type,
          ttl,
          value,
        }
      })
    )

    return NextResponse.json({
      prefix: getKeyPrefix(),
      count: items.length,
      items,
    })
  } catch (error) {
    console.error("[redis GET]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list Redis keys",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/redis
 * Create a string key.
 * Body: { key: string, value: string, ttlSeconds?: number }
 */
export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { key?: string; value?: string; ttlSeconds?: number }
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

    const fullKey = toRedisKey(body.key ?? "")
    const redis = await ensureRedisConnected()

    const exists = await redis.exists(fullKey)
    if (exists) {
      return NextResponse.json(
        { error: "Key already exists. Use PUT to update." },
        { status: 409 }
      )
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

    return NextResponse.json(
      {
        key: fromRedisKey(fullKey),
        fullKey,
        value: body.value,
        ttl: ttl ?? -1,
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Redis key"
    const status = message.includes("required") || message.includes("chars")
      ? 400
      : 500
    if (status === 500) console.error("[redis POST]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
