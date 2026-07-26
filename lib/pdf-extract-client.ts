/**
 * Client for Docker pdf-extract service (PyMuPDF + OCRmyPDF/Tesseract F1b).
 */

export type PdfExtractResult = {
  text: string | null
  pageCount: number
  method: string
  ocrUsed: boolean
  warnings: string[]
  reason: string | null
}

export type PdfOcrMode = "off" | "auto" | "force"

export function getPdfExtractUrl() {
  return (
    process.env.PDF_EXTRACT_URL?.trim().replace(/\/$/, "") ||
    "http://127.0.0.1:8090"
  )
}

/** Default for ingest: auto (native first, OCR if needed). */
export function getPdfOcrMode(): PdfOcrMode {
  const raw = process.env.PDF_OCR_MODE?.trim().toLowerCase()
  if (raw === "off" || raw === "force" || raw === "auto") return raw
  return "auto"
}

export async function extractPdfText(
  pdfBytes: Buffer,
  options?: { ocr?: PdfOcrMode }
): Promise<PdfExtractResult> {
  const ocr = options?.ocr ?? getPdfOcrMode()
  const base = getPdfExtractUrl()
  const url = `${base}/extract?ocr=${encodeURIComponent(ocr)}`
  // OCR can be slow on multi-page scans
  const timeoutMs = Number(
    process.env.PDF_EXTRACT_TIMEOUT_MS || (ocr === "off" ? 120_000 : 300_000)
  )

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Accept: "application/json",
      },
      body: new Uint8Array(pdfBytes),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF extract request failed"
    throw new Error(
      `PDF extract service unreachable (${base}): ${message}. Is docker compose service pdf-extract running?`
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `PDF extract failed (${res.status}): ${body.slice(0, 400) || res.statusText}`
    )
  }

  const data = (await res.json()) as PdfExtractResult
  return {
    text: data.text ?? null,
    pageCount: data.pageCount ?? 0,
    method: data.method ?? "pymupdf",
    ocrUsed: Boolean(data.ocrUsed),
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    reason: data.reason ?? null,
  }
}
