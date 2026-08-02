/**
 * Extract plain text from allowed formats.
 * - txt/md/csv/rtf: in-process UTF-8
 * - pdf: Docker pdf-extract (PyMuPDF native + Tesseract when ocr=auto|force)
 * - docx: in-process Mammoth (open-source .docx → text)
 * - doc: legacy binary Word — not supported (save as .docx)
 */

import mammoth from "mammoth"

import { extractPdfText, getPdfOcrMode } from "@/lib/pdf-extract-client"

export type ExtractResult =
  | { text: string; method: string }
  | { text: null; method: string; reason: string }

function applyMaxChars(text: string): string {
  const maxChars = Number(process.env.INGEST_MAX_CHARS || 500_000)
  if (text.length > maxChars) {
    return text.slice(0, maxChars)
  }
  return text
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\uFEFF/, "")
    .trim()
}

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
    text = normalizeExtractedText(text)
    if (!text) {
      return { text: null, method: "utf8", reason: "empty_text" }
    }
    return { text: applyMaxChars(text), method: "utf8" }
  }

  if (lower.endsWith(".pdf")) {
    // Sync API cannot call Python — use extractDocumentText()
    return {
      text: null,
      method: "pdf",
      reason: "Use extractDocumentText for PDF (async service call)",
    }
  }

  if (lower.endsWith(".docx")) {
    return {
      text: null,
      method: "docx",
      reason: "Use extractDocumentText for DOCX (async Mammoth)",
    }
  }

  if (lower.endsWith(".doc")) {
    return {
      text: null,
      method: "doc_legacy",
      reason:
        "Legacy .doc is not supported. Save or export as .docx and re-upload.",
    }
  }

  return {
    text: null,
    method: "unsupported",
    reason:
      "Text extraction for this type is not enabled yet (use .txt, .md, .csv, .pdf, or .docx)",
  }
}

/**
 * Extract text from a Word .docx buffer using Mammoth (no Docker).
 */
export async function extractDocxText(body: Buffer): Promise<ExtractResult> {
  try {
    const result = await mammoth.extractRawText({ buffer: body })
    const text = normalizeExtractedText(result.value || "")
    if (!text) {
      return {
        text: null,
        method: "mammoth",
        reason:
          "No extractable text in Word document (empty body, image-only, or protected content).",
      }
    }
    return { text: applyMaxChars(text), method: "mammoth" }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "DOCX extract failed"
    return { text: null, method: "mammoth", reason: message }
  }
}

/**
 * Async extract: PDF via Docker pdf-extract; DOCX via Mammoth; else plain text.
 */
export async function extractDocumentText(
  filename: string,
  body: Buffer
): Promise<ExtractResult> {
  const lower = filename.toLowerCase()

  if (lower.endsWith(".pdf")) {
    try {
      const result = await extractPdfText(body, { ocr: getPdfOcrMode() })
      if (result.text) {
        const text = applyMaxChars(normalizeExtractedText(result.text))
        if (!text) {
          return {
            text: null,
            method: result.method || "pdf",
            reason: "No extractable text after native extract and/or OCR.",
          }
        }
        return { text, method: result.method || "pymupdf" }
      }
      return {
        text: null,
        method: result.method || "pdf",
        reason:
          result.reason ||
          "No extractable text after native extract and/or OCR.",
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF extract failed"
      return { text: null, method: "pdf_service", reason: message }
    }
  }

  if (lower.endsWith(".docx")) {
    return extractDocxText(body)
  }

  if (lower.endsWith(".doc")) {
    return {
      text: null,
      method: "doc_legacy",
      reason:
        "Legacy .doc is not supported. Save or export as .docx and re-upload.",
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
