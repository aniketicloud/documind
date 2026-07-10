import Redis from "ioredis"

const KEY_PREFIX = "documind:kv:"

/** Prefer 127.0.0.1 — on Windows, `localhost` can resolve to IPv6 (::1) while Docker binds IPv4. */
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379"

let client: Redis | null = null

function normalizeRedisUrl(url: string) {
  return url.replace("://localhost", "://127.0.0.1")
}

export function getRedis() {
  // Drop dead clients (HMR / previous failed connects)
  if (
    client &&
    (client.status === "end" ||
      client.status === "close" ||
      client.status === "reconnecting")
  ) {
    try {
      client.disconnect()
    } catch {
      // ignore
    }
    client = null
  }

  if (!client) {
    const url = normalizeRedisUrl(
      process.env.REDIS_URL?.trim() || DEFAULT_REDIS_URL
    )

    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      enableOfflineQueue: true,
      // Connect immediately — more reliable than lazyConnect in Next.js route handlers
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          return null
        }
        return Math.min(times * 200, 1_000)
      },
    })

    client.on("error", (err) => {
      // Prevent unhandled error crash; surface via request handlers
      console.error("[redis]", err.message)
    })
  }

  return client
}

export function toRedisKey(name: string) {
  const clean = name.trim()
  if (!clean) {
    throw new Error("Key is required")
  }
  if (clean.includes(":") || clean.includes(" ") || clean.length > 200) {
    throw new Error(
      "Key must be 1–200 chars without spaces or colons (stored under documind:kv:)"
    )
  }
  return `${KEY_PREFIX}${clean}`
}

export function fromRedisKey(fullKey: string) {
  if (!fullKey.startsWith(KEY_PREFIX)) return fullKey
  return fullKey.slice(KEY_PREFIX.length)
}

export function getKeyPrefix() {
  return KEY_PREFIX
}

export async function ensureRedisConnected() {
  const redis = getRedis()

  // Wait until ready if still connecting
  if (redis.status !== "ready") {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `Redis not ready (status: ${redis.status}). Is Docker Redis running on 6379? Check REDIS_URL.`
          )
        )
      }, 5_000)

      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }
      const cleanup = () => {
        clearTimeout(timeout)
        redis.off("ready", onReady)
        redis.off("error", onError)
      }

      if (redis.status === "ready") {
        cleanup()
        resolve()
        return
      }

      redis.once("ready", onReady)
      redis.once("error", onError)

      // If waiting with lazyConnect (legacy), start connect
      if (redis.status === "wait") {
        redis.connect().catch(onError)
      }
    })
  }

  // Verify with PING
  const pong = await redis.ping()
  if (pong !== "PONG") {
    throw new Error("Redis PING failed")
  }

  return redis
}
