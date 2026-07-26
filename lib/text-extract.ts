/**
 * Extract plain text from allowed formats.
 * - txt/md/csv/rtf: in-process UTF-8
 * - pdf: Python pdf-extract service (PyMuPDF); OCR later via same API
 */

import { extractPdfText } from "@/lib/pdf-extract-client"

export type ExtractResult =
  | { text: string; method: string }
  | { text: null; method: string; reason: string }

export function extractPlainText(
  filename: string,
  body: Buffer
): ExtractResult {
  const lower = filename.toLowerCase()

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".rtf")
  ) {
    let text = body.toString("utf8")
    if (lower.endsWith(".rtf")) {
      text = text
        .replace(/\\[a-z]+\d* ?/gi, " ")
        .replace(/[{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }
    text = text.replace(/^\uFEFF/, "").trim()
    if (!text) {
      return { text: null, method: "utf8", reason: "empty_text" }
    }
    const maxChars = Number(process.env.INGEST_MAX_CHARS || 500_000)
    if (text.length > maxChars) {
      text = text.slice(0, maxChars)
    }
    return { text, method: "utf8" }
  }

  if (lower.endsWith(".pdf")) {
    // Sync API cannot call Python — use extractDocumentText()
    return {
      text: null,
      method: "pdf",
      reason: "Use extractDocumentText for PDF (async service call)",
    }
  }

  return {
    text: null,
    method: "unsupported",
    reason:
      "Text extraction for this type is not enabled yet (use .txt, .md, .csv, or .pdf)",
  }
}

/**
 * Async extract: handles PDF via Docker pdf-extract service.
 */
export async function extractDocumentText(
  filename: string,
  body: Buffer
): Promise<ExtractResult> {
  const lower = filename.toLowerCase()

  if (lower.endsWith(".pdf")) {
    try {
      const result = await extractPdfText(body, { ocr: "off" })
      if (result.text) {
        return { text: result.text, method: result.method || "pymupdf" }
      }
      return {
        text: null,
        method: result.method || "pymupdf",
        reason:
          result.reason ||
          "No extractable text (scanned/image PDF?). OCR is not enabled yet.",
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF extract failed"
      return { text: null, method: "pdf_service", reason: message }
    }
  }

  return extractPlainText(filename, body)
}

/** Split text into overlapping chunks for embedding. */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): string[] {
  const chunkSize = options?.chunkSize ?? 1200
  const overlap = options?.overlap ?? 200
  const cleaned = text.replace(/\r\n/g, "\n").trim()
  if (!cleaned) return []

  if (cleaned.length <= chunkSize) return [cleaned]

  const chunks: string[] = []
  let start = 0
  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length)
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end)
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". ")
      )
      if (lastBreak > chunkSize * 0.4) {
        end = start + lastBreak + 1
      }
    }
    const piece = cleaned.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= cleaned.length) break
    start = Math.max(0, end - overlap)
  }
  return chunks
}
