import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { documents } from "@/db/schema"
import { embedText } from "@/lib/gemini"
import { streamChatCompletion } from "@/lib/llm"
import { searchDocumentChunks, type ChunkPayload } from "@/lib/qdrant"

export async function getIndexedOwnedDocuments(
  userId: string,
  documentIds: string[]
) {
  if (documentIds.length === 0) return []
  const unique = [...new Set(documentIds)]
  return db
    .select({
      id: documents.id,
      name: documents.name,
      status: documents.status,
    })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, unique),
        eq(documents.status, "indexed")
      )
    )
}

export async function retrieveContext(options: {
  userId: string
  documentIds: string[]
  query: string
}) {
  const indexed = await getIndexedOwnedDocuments(
    options.userId,
    options.documentIds
  )
  if (indexed.length === 0) {
    return {
      chunks: [] as { score: number; payload: ChunkPayload }[],
      indexedDocs: indexed,
      note: "none_indexed" as const,
    }
  }

  const query =
    options.query.trim() ||
    "Summarize the main points of the attached document(s)."

  // Embeddings use gemini-embedding-2 (same space as ingest)
  const vector = await embedText(query, { kind: "query" })
  const chunks = await searchDocumentChunks({
    userId: options.userId,
    documentIds: indexed.map((d) => d.id),
    vector,
    limit: 6,
  })

  return {
    chunks,
    indexedDocs: indexed,
    note: chunks.length === 0 ? ("no_chunks" as const) : ("ok" as const),
  }
}

export function buildRagPrompt(options: {
  query: string
  chunks: { score: number; payload: ChunkPayload }[]
  documentNames: string[]
}) {
  const contextBlocks = options.chunks.map((c, i) => {
    const name = c.payload.documentName || c.payload.documentId
    return `[${i + 1}] Source: ${name} (chunk ${c.payload.chunkIndex})\n${c.payload.text}`
  })

  const system = `You are Documind, a helpful assistant that answers using only the provided document context.
Rules:
- Base answers on the context excerpts when they are present.
- If the context is empty or insufficient, say so clearly and do not invent document contents.
- When you use information from a source, mention the document name.
- Be concise and accurate.
- Documents available: ${options.documentNames.join(", ") || "none"}.`

  const user = `Question:
${options.query}

Context excerpts:
${contextBlocks.length > 0 ? contextBlocks.join("\n\n") : "(No searchable text chunks. The attached files may not be text-extractable yet, or ingest has not indexed content.)"}

Answer:`

  return { system, user }
}

export function buildGeneralPrompt(query: string) {
  const system = `You are Documind, a helpful assistant for document-centric work.
You can chat normally when no documents are attached. Be concise, friendly, and accurate.
When the user attaches indexed documents on a later message, prefer those sources.`

  return { system, user: query }
}

export async function* streamRagAnswer(options: {
  userId: string
  documentIds: string[]
  query: string
  modelId?: string | null
}) {
  const query =
    options.query.trim() ||
    "Summarize the main points of the attached document(s)."

  // No attachments → general chat (no embedding / Qdrant)
  if (options.documentIds.length === 0) {
    const { system, user } = buildGeneralPrompt(query)
    for await (const token of streamChatCompletion({
      system,
      user,
      modelId: options.modelId,
    })) {
      yield token
    }
    return
  }

  const { chunks, indexedDocs, note } = await retrieveContext({
    userId: options.userId,
    documentIds: options.documentIds,
    query,
  })

  if (note === "none_indexed") {
    yield "I can only answer from **indexed** documents. The attached file(s) are not indexed yet (still processing, failed, or not text-extractable for RAG). Open **My documents**, wait for status `indexed`, or use a `.txt` / `.md` / `.csv` file and ensure `npm run worker:ingest` is running. You can still chat without attachments, or switch model in the composer if one provider is rate-limited."
    return
  }

  const { system, user } = buildRagPrompt({
    query,
    chunks,
    documentNames: indexedDocs.map((d) => d.name),
  })

  for await (const token of streamChatCompletion({
    system,
    user,
    modelId: options.modelId,
  })) {
    yield token
  }
}
