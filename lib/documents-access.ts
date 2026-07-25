import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { documents } from "@/db/schema"

export type DocumentRow = typeof documents.$inferSelect

/**
 * Load a document only if it belongs to `userId`.
 * Never returns another user's row (same 404 surface for missing vs other owner).
 */
export async function getOwnedDocument(
  userId: string,
  documentId: string
): Promise<DocumentRow | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1)

  return doc ?? null
}

/** Public API shape — never includes storage `key` or `userId`. */
export function toPublicDocument(doc: DocumentRow) {
  return {
    id: doc.id,
    name: doc.name,
    contentType: doc.contentType,
    size: doc.size,
    status: doc.status,
    errorMessage: doc.errorMessage,
    processedAt: doc.processedAt,
    ingestAttempts: doc.ingestAttempts,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/** Object keys are always under the owning user prefix. */
export function buildUserObjectKey(
  userId: string,
  documentId: string,
  safeFilename: string
) {
  return `users/${userId}/${documentId}/${safeFilename}`
}

export function isKeyOwnedByUser(key: string, userId: string) {
  return key.startsWith(`users/${userId}/`)
}
