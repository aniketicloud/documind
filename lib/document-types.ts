/** Max upload size: 50MB */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

/**
 * Text-oriented document formats only (no images/audio/video/archives).
 * Used by browser file pickers and server presign validation.
 */
export const DOCUMENT_EXTENSIONS = [
  // PDF
  ".pdf",
  // Word
  ".doc",
  ".docx",
  // Excel / spreadsheets
  ".xls",
  ".xlsx",
  ".csv",
  // Text / markdown / rich text
  ".txt",
  ".md",
  ".markdown",
  ".rtf",
  // OpenDocument text/spreadsheet
  ".odt",
  ".ods",
] as const

/** MIME types commonly reported by browsers for the extensions above. */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/rtf",
  "text/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  // Browsers often omit type for .md / .txt → empty string; we allow and re-check extension
  "",
] as const

const EXT_SET = new Set(
  DOCUMENT_EXTENSIONS.map((ext) => ext.toLowerCase())
)

const MIME_SET = new Set(
  DOCUMENT_MIME_TYPES.map((mime) => mime.toLowerCase())
)

/** Value for `<input type="file" accept="…">` */
export const DOCUMENT_ACCEPT = [
  ...DOCUMENT_EXTENSIONS,
  ...DOCUMENT_MIME_TYPES.filter(Boolean),
].join(",")

export function getFileExtension(filename: string) {
  const base = filename.trim().split(/[/\\]/).pop() ?? filename
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return ""
  return base.slice(dot).toLowerCase()
}

export function isAllowedDocumentExtension(filename: string) {
  return EXT_SET.has(getFileExtension(filename))
}

/**
 * Validate a file for upload. Prefer extension (reliable); MIME is secondary
 * because many browsers send empty or generic types.
 */
export function validateDocumentFile(input: {
  filename: string
  contentType?: string | null
  size?: number | null
}): { ok: true } | { ok: false; error: string } {
  const filename = input.filename?.trim()
  if (!filename) {
    return { ok: false, error: "Filename is required" }
  }

  if (!isAllowedDocumentExtension(filename)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${DOCUMENT_EXTENSIONS.join(", ")}`,
    }
  }

  if (
    typeof input.size === "number" &&
    Number.isFinite(input.size) &&
    input.size > MAX_DOCUMENT_BYTES
  ) {
    return { ok: false, error: "File exceeds 50MB limit" }
  }

  if (
    typeof input.size === "number" &&
    Number.isFinite(input.size) &&
    input.size <= 0
  ) {
    return { ok: false, error: "File is empty" }
  }

  const contentType = (input.contentType ?? "").trim().toLowerCase()
  // Empty MIME is fine if extension is allowed (common for .md)
  if (
    contentType &&
    contentType !== "application/octet-stream" &&
    !MIME_SET.has(contentType)
  ) {
    // Still allow if extension is allowed — some OS send weird MIME for office files
    // but reject clearly non-text types
    if (
      contentType.startsWith("image/") ||
      contentType.startsWith("audio/") ||
      contentType.startsWith("video/") ||
      contentType === "application/zip" ||
      contentType === "application/x-msdownload" ||
      contentType === "application/javascript"
    ) {
      return {
        ok: false,
        error: "Only text documents are allowed (PDF, Word, Excel, TXT, Markdown, etc.)",
      }
    }
  }

  return { ok: true }
}

/** Resolve a stable content-type for storage when the browser sends none. */
export function resolveDocumentContentType(
  filename: string,
  contentType?: string | null
) {
  const provided = contentType?.trim()
  if (
    provided &&
    provided !== "application/octet-stream" &&
    MIME_SET.has(provided.toLowerCase())
  ) {
    return provided
  }

  switch (getFileExtension(filename)) {
    case ".pdf":
      return "application/pdf"
    case ".doc":
      return "application/msword"
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case ".xls":
      return "application/vnd.ms-excel"
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    case ".csv":
      return "text/csv"
    case ".txt":
      return "text/plain"
    case ".md":
    case ".markdown":
      return "text/markdown"
    case ".rtf":
      return "application/rtf"
    case ".odt":
      return "application/vnd.oasis.opendocument.text"
    case ".ods":
      return "application/vnd.oasis.opendocument.spreadsheet"
    default:
      return "application/octet-stream"
  }
}
