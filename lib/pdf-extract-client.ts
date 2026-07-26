/**
 * Client for the local Python pdf-extract service (PyMuPDF F1).
 * OCR modes auto|force are reserved for F1b (501 from service).
 */

export type PdfExtractResult = {
  text: string | null
  pageCount: number
  method: string
  ocrUsed: boolean
  warnings: string[]
  reason: string | null
}

export function getPdfExtractUrl() {
  return (
    process.env.PDF_EXTRACT_URL?.trim().replace(/\/$/, "") ||
    "http://127.0.0.1:8090"
  )
}

export async function extractPdfText(
  pdfBytes: Buffer,
  options?: { ocr?: "off" | "auto" | "force" }
): Promise<PdfExtractResult> {
  const ocr = options?.ocr ?? "off"
  const base = getPdfExtractUrl()
  const url = `${base}/extract?ocr=${encodeURIComponent(ocr)}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Accept: "application/json",
      },
      body: new Uint8Array(pdfBytes),
      // Node fetch
      signal: AbortSignal.timeout(
        Number(process.env.PDF_EXTRACT_TIMEOUT_MS || 120_000)
      ),
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
