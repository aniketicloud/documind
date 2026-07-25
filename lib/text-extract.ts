/**
 * Extract plain text from allowed simple formats (B2).
 * PDF/DOCX/XLSX return null → document can still be "indexed" for storage
 * but RAG will note no searchable text until Option F parsers land.
 */
export function extractPlainText(
  filename: string,
  body: Buffer
): { text: string; method: string } | { text: null; method: string; reason: string } {
  const lower = filename.toLowerCase()

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".rtf")
  ) {
    // Strip basic RTF control words if needed later; for now UTF-8
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
    // Cap very large files for free-tier embeddings
    const maxChars = Number(process.env.INGEST_MAX_CHARS || 500_000)
    if (text.length > maxChars) {
      text = text.slice(0, maxChars)
    }
    return { text, method: "utf8" }
  }

  return {
    text: null,
    method: "unsupported",
    reason: "Text extraction for this type is not enabled yet (use .txt, .md, or .csv for RAG)",
  }
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
    // Prefer break on paragraph/newline
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
