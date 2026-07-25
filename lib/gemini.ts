/**
 * Gemini via official @google/genai SDK (Interactions API + modern embeddings).
 * No legacy @google/generative-ai / generateContent usage.
 */
import { GoogleGenAI } from "@google/genai"

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set")
  }
  return key
}

export function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getApiKey() })
}

export function getChatModelName() {
  return process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-3.1-flash-lite"
}

export function getEmbedModelName() {
  return process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-2"
}

/**
 * Matryoshka output size for gemini-embedding-2 (recommended: 768, 1536, 3072).
 * Must match Qdrant collection vector size.
 */
export const EMBEDDING_DIMENSIONS = Number(
  process.env.GEMINI_EMBED_DIMENSIONS?.trim() || 768
)

/** Format document chunk for retrieval (Embeddings 2 asymmetric task). */
export function prepareEmbedDocument(content: string, title?: string) {
  const t = title?.trim() || "none"
  return `title: ${t} | text: ${content}`
}

/** Format search query for retrieval (Embeddings 2 asymmetric task). */
export function prepareEmbedQuery(query: string) {
  return `task: search result | query: ${query}`
}

export async function embedText(
  text: string,
  options?: { kind?: "document" | "query"; title?: string }
): Promise<number[]> {
  const kind = options?.kind ?? "document"
  const prepared =
    kind === "query"
      ? prepareEmbedQuery(text)
      : prepareEmbedDocument(text, options?.title)

  const input = prepared.slice(0, 20_000)
  const ai = getGeminiClient()
  const response = await ai.models.embedContent({
    model: getEmbedModelName(),
    contents: input,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values?.length) {
    throw new Error("Empty embedding from Gemini")
  }
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dim mismatch: got ${values.length}, expected ${EMBEDDING_DIMENSIONS}`
    )
  }
  return values as number[]
}

export async function embedTexts(
  texts: string[],
  options?: { title?: string }
): Promise<number[][]> {
  const out: number[][] = []
  // Sequential to stay within free-tier rate limits
  for (const t of texts) {
    out.push(
      await embedText(t, { kind: "document", title: options?.title })
    )
    await new Promise((r) => setTimeout(r, 50))
  }
  return out
}

export type StreamGenerateOptions = {
  system: string
  user: string
  model?: string
}

/**
 * Stream plain text from Interactions API (`store: false` — we persist chat in Postgres).
 */
export async function* streamGenerateText(
  options: StreamGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const ai = getGeminiClient()
  const model = options.model?.trim() || getChatModelName()

  const stream = await ai.interactions.create({
    model,
    input: options.user,
    system_instruction: options.system,
    stream: true,
    store: false,
  })

  for await (const event of stream) {
    const e = event as {
      event_type?: string
      delta?: { type?: string; text?: string }
    }
    if (
      e.event_type === "step.delta" &&
      e.delta?.type === "text" &&
      e.delta.text
    ) {
      yield e.delta.text
    }
  }
}

export async function generateTextOnce(options: StreamGenerateOptions) {
  let full = ""
  for await (const t of streamGenerateText(options)) {
    full += t
  }
  return full
}
