import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { documentJobs, documents } from "@/db/schema"
import { ensureRedisConnected } from "@/lib/redis"
import { getObjectBytes, objectExists } from "@/lib/s3"

/** Redis list used as a lightweight job queue. */
export const INGEST_QUEUE_KEY = "documind:ingest:queue"

export const MAX_INGEST_ATTEMPTS = 5

export type IngestQueuePayload = {
  jobId: string
  documentId: string
  userId: string
}

/**
 * Create a queued ingest job (if none active) and push to Redis.
 * Safe to call multiple times — reuses queued/running job or creates a new one after failure/success reprocess.
 */
export async function enqueueDocumentIngest(options: {
  documentId: string
  userId: string
  /** Force a new job even if already indexed (reprocess). */
  force?: boolean
}) {
  const { documentId, userId, force = false } = options

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1)

  if (!doc) {
    throw new Error("Document not found")
  }

  if (!force && (doc.status === "processing" || doc.status === "indexed")) {
    const [existing] = await db
      .select()
      .from(documentJobs)
      .where(
        and(
          eq(documentJobs.documentId, documentId),
          inArray(documentJobs.status, ["queued", "running"])
        )
      )
      .limit(1)

    if (existing) {
      return { job: existing, enqueued: false as const, document: doc }
    }
    if (doc.status === "indexed" && !force) {
      return { job: null, enqueued: false as const, document: doc }
    }
  }

  // Cancel leftover queued jobs when reprocessing
  if (force) {
    await db
      .update(documentJobs)
      .set({
        status: "failed",
        lastError: "Superseded by reprocess",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentJobs.documentId, documentId),
          inArray(documentJobs.status, ["queued", "running"])
        )
      )
  }

  const jobId = crypto.randomUUID()
  const now = new Date()

  const [job] = await db
    .insert(documentJobs)
    .values({
      id: jobId,
      documentId,
      userId,
      type: "ingest",
      status: "queued",
      attempts: 0,
      maxAttempts: MAX_INGEST_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db
    .update(documents)
    .set({
      status: "processing",
      errorMessage: null,
      updatedAt: now,
    })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))

  const payload: IngestQueuePayload = {
    jobId,
    documentId,
    userId,
  }

  try {
    const redis = await ensureRedisConnected()
    await redis.lpush(INGEST_QUEUE_KEY, JSON.stringify(payload))
  } catch (error) {
    // Job remains queued in Postgres; worker can also poll DB as fallback
    console.error("[ingest] Redis enqueue failed; job remains in Postgres", error)
  }

  const [updatedDoc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  return {
    job,
    enqueued: true as const,
    document: updatedDoc ?? doc,
  }
}

/** Claim next job: prefer Redis, fall back to Postgres queued rows. */
export async function claimNextIngestJob(workerId: string) {
  // 1) Try Redis
  try {
    const redis = await ensureRedisConnected()
    const raw = await redis.rpop(INGEST_QUEUE_KEY)
    if (raw) {
      const payload = JSON.parse(raw) as IngestQueuePayload
      const claimed = await tryClaimJob(payload.jobId, workerId)
      if (claimed) return claimed
    }
  } catch (error) {
    console.error("[ingest] Redis claim failed, using Postgres", error)
  }

  // 2) Postgres: queued, or stale running locks (> 5 min)
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000)
  const [candidate] = await db
    .select()
    .from(documentJobs)
    .where(
      or(
        eq(documentJobs.status, "queued"),
        and(
          eq(documentJobs.status, "running"),
          or(
            isNull(documentJobs.lockedAt),
            lt(documentJobs.lockedAt, staleBefore)
          )
        )
      )
    )
    .orderBy(asc(documentJobs.createdAt))
    .limit(1)

  if (!candidate) return null
  return tryClaimJob(candidate.id, workerId)
}

async function tryClaimJob(jobId: string, workerId: string) {
  const now = new Date()
  const [claimed] = await db
    .update(documentJobs)
    .set({
      status: "running",
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${documentJobs.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(documentJobs.id, jobId),
        inArray(documentJobs.status, ["queued", "running"])
      )
    )
    .returning()

  return claimed ?? null
}

/**
 * Ingest: download object → extract text (txt/md/csv) → chunk → embed → Qdrant.
 * Binary office/PDF without extractors still mark indexed for storage, but with a note
 * that RAG has no chunks (Option F will add parsers).
 */
export async function processIngestJob(job: typeof documentJobs.$inferSelect) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, job.documentId))
    .limit(1)

  if (!doc) {
    await failJob(job.id, job.documentId, "Document row missing")
    return { ok: false as const, reason: "missing_document" }
  }

  if (doc.userId !== job.userId) {
    await failJob(job.id, job.documentId, "Document ownership mismatch")
    return { ok: false as const, reason: "ownership" }
  }

  const head = await objectExists(doc.key)
  if (!head.exists) {
    await failJob(job.id, job.documentId, "Object not found in storage")
    return { ok: false as const, reason: "missing_object" }
  }

  const object = await getObjectBytes(doc.key)
  if (!object.body.length) {
    await failJob(job.id, job.documentId, "Object body is empty")
    return { ok: false as const, reason: "empty_object" }
  }

  // Dynamic import keeps worker resilient if AI libs misconfigure
  const { extractDocumentText, chunkText } = await import("@/lib/text-extract")
  const extracted = await extractDocumentText(doc.name, object.body)

  let chunkCount = 0

  if (extracted.text) {
    try {
      const { embedTexts } = await import("@/lib/gemini")
      const {
        deleteDocumentChunks,
        upsertDocumentChunks,
        chunkPointId,
      } = await import("@/lib/qdrant")

      const chunks = chunkText(extracted.text)
      if (chunks.length === 0) {
        await failJob(job.id, job.documentId, "No text chunks produced")
        return { ok: false as const, reason: "no_chunks" }
      }

      await deleteDocumentChunks(doc.id)
      const vectors = await embedTexts(chunks, { title: doc.name })
      const points = chunks.map((text, chunkIndex) => ({
        id: chunkPointId(doc.id, chunkIndex),
        vector: vectors[chunkIndex]!,
        payload: {
          userId: doc.userId,
          documentId: doc.id,
          documentName: doc.name,
          chunkIndex,
          text,
        },
      }))
      await upsertDocumentChunks(points)
      chunkCount = chunks.length
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Embedding/Qdrant failed"
      await failJob(job.id, job.documentId, message)
      return { ok: false as const, reason: "embed_failed" }
    }
  } else if (
    extracted.text === null &&
    (extracted.method === "utf8" ||
      extracted.method === "pymupdf" ||
      extracted.method === "ocr_tesseract" ||
      extracted.method === "pdf_service" ||
      extracted.method === "pdf")
  ) {
    // Empty text / PDF extract failure → failed (user can reprocess after OCR lands)
    await failJob(
      job.id,
      job.documentId,
      extracted.reason || "No extractable text"
    )
    return { ok: false as const, reason: "empty_text" }
  } else {
    // Unsupported type for text RAG: still mark indexed for storage lifecycle,
    // but clear any old vectors and leave a soft note in errorMessage
    try {
      const { deleteDocumentChunks } = await import("@/lib/qdrant")
      await deleteDocumentChunks(doc.id)
    } catch {
      // Qdrant optional if down — still index as storage-ok
    }
  }

  const now = new Date()
  const note =
    chunkCount > 0
      ? null
      : extracted.text === null && "reason" in extracted
        ? extracted.reason
        : null

  await db
    .update(documents)
    .set({
      status: "indexed",
      errorMessage: note,
      processedAt: now,
      size: head.size ?? doc.size ?? object.body.length,
      contentType: head.contentType ?? doc.contentType,
      ingestAttempts: job.attempts,
      updatedAt: now,
    })
    .where(eq(documents.id, doc.id))

  await db
    .update(documentJobs)
    .set({
      status: "succeeded",
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(eq(documentJobs.id, job.id))

  return {
    ok: true as const,
    documentId: doc.id,
    bytes: object.body.length,
    chunks: chunkCount,
  }
}

export async function failJob(
  jobId: string,
  documentId: string,
  message: string
) {
  const now = new Date()
  const [job] = await db
    .select()
    .from(documentJobs)
    .where(eq(documentJobs.id, jobId))
    .limit(1)

  const attempts = job?.attempts ?? 1
  const maxAttempts = job?.maxAttempts ?? MAX_INGEST_ATTEMPTS
  const permanent = attempts >= maxAttempts

  await db
    .update(documentJobs)
    .set({
      status: permanent ? "failed" : "queued",
      lastError: message,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(eq(documentJobs.id, jobId))

  await db
    .update(documents)
    .set({
      status: permanent ? "failed" : "processing",
      errorMessage: message,
      ingestAttempts: attempts,
      updatedAt: now,
    })
    .where(eq(documents.id, documentId))

  // Re-queue for retry if not permanent
  if (!permanent && job) {
    try {
      const redis = await ensureRedisConnected()
      await redis.lpush(
        INGEST_QUEUE_KEY,
        JSON.stringify({
          jobId: job.id,
          documentId: job.documentId,
          userId: job.userId,
        } satisfies IngestQueuePayload)
      )
    } catch {
      // Postgres poll will pick it up
    }
  }
}
