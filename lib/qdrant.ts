import { QdrantClient } from "@qdrant/js-client-rest"

import { EMBEDDING_DIMENSIONS } from "@/lib/gemini"

function getUrl() {
  const raw = process.env.QDRANT_URL?.trim()
  if (!raw) return "http://127.0.0.1:6335"
  return raw.replace("localhost", "127.0.0.1")
}

export function getQdrantCollection() {
  return process.env.QDRANT_COLLECTION?.trim() || "documind_chunks"
}

export function getQdrantClient() {
  return new QdrantClient({ url: getUrl() })
}

export type ChunkPayload = {
  userId: string
  documentId: string
  documentName: string
  chunkIndex: number
  text: string
}

let collectionReady: Promise<void> | null = null

export async function ensureQdrantCollection() {
  if (!collectionReady) {
    collectionReady = (async () => {
      const client = getQdrantClient()
      const name = getQdrantCollection()
      const collections = await client.getCollections()
      const exists = collections.collections.some((c) => c.name === name)

      if (exists) {
        // Recreate if vector size changed (e.g. text-embedding-004 → gemini-embedding-2)
        try {
          const info = await client.getCollection(name)
          const size =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (info.config?.params?.vectors as any)?.size as number | undefined
          if (size != null && size !== EMBEDDING_DIMENSIONS) {
            console.warn(
              `[qdrant] Recreating collection "${name}" (${size} → ${EMBEDDING_DIMENSIONS} dims). Re-run document ingest.`
            )
            await client.deleteCollection(name)
          }
        } catch (error) {
          console.error("[qdrant] Failed to inspect collection", error)
        }
      }

      const after = await client.getCollections()
      const stillExists = after.collections.some((c) => c.name === name)
      if (!stillExists) {
        await client.createCollection(name, {
          vectors: {
            size: EMBEDDING_DIMENSIONS,
            distance: "Cosine",
          },
        })
      }

      // Payload indexes for filtered search
      try {
        await client.createPayloadIndex(name, {
          field_name: "userId",
          field_schema: "keyword",
        })
      } catch {
        // already exists
      }
      try {
        await client.createPayloadIndex(name, {
          field_name: "documentId",
          field_schema: "keyword",
        })
      } catch {
        // already exists
      }
    })().catch((err) => {
      collectionReady = null
      throw err
    })
  }
  return collectionReady
}

/** Stable UUID-like id for Qdrant points from document + chunk index. */
export function chunkPointId(documentId: string, chunkIndex: number) {
  // Qdrant accepts unsigned int or UUID — use deterministic UUID v5-like hash as string uuid format
  // Simpler: use hash to uint (may collide) — prefer UUID string from crypto
  const data = `${documentId}:${chunkIndex}`
  // Create a deterministic UUID from hash
  const hex = simpleHashHex(data).padEnd(32, "0").slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function simpleHashHex(input: string) {
  // FNV-1a 128-bit-ish via double hashing for point ids
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5 ^ 0xabcdef
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x01000193) ^ (h1 >>> 16)
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0")
  const b = (h2 >>> 0).toString(16).padStart(8, "0")
  const c = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0")
  const d = (Math.imul(h1, h2) >>> 0).toString(16).padStart(8, "0")
  return a + b + c + d
}

export async function deleteDocumentChunks(documentId: string) {
  await ensureQdrantCollection()
  const client = getQdrantClient()
  const name = getQdrantCollection()
  await client.delete(name, {
    wait: true,
    filter: {
      must: [{ key: "documentId", match: { value: documentId } }],
    },
  })
}

export async function upsertDocumentChunks(
  points: {
    id: string
    vector: number[]
    payload: ChunkPayload
  }[]
) {
  if (points.length === 0) return
  await ensureQdrantCollection()
  const client = getQdrantClient()
  const name = getQdrantCollection()

  // Batch upserts
  const batchSize = 32
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize)
    await client.upsert(name, {
      wait: true,
      points: batch.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    })
  }
}

export async function searchDocumentChunks(options: {
  userId: string
  documentIds: string[]
  vector: number[]
  limit?: number
}) {
  if (options.documentIds.length === 0) return []

  await ensureQdrantCollection()
  const client = getQdrantClient()
  const name = getQdrantCollection()
  const limit = options.limit ?? 6

  const results = await client.search(name, {
    vector: options.vector,
    limit,
    with_payload: true,
    filter: {
      must: [
        { key: "userId", match: { value: options.userId } },
        {
          key: "documentId",
          match: { any: options.documentIds },
        },
      ],
    },
  })

  return results.map((r) => ({
    score: r.score,
    payload: r.payload as ChunkPayload,
  }))
}
