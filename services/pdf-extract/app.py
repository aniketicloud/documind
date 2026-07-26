"""
Documind PDF text extraction service (F1).

- F1: native text via PyMuPDF only (ocr=off).
- Later (F1b): ocr=auto|force with Tesseract — same API shape.

POST /extract?ocr=off|auto|force
  body: application/pdf raw bytes  OR  multipart file field "file"
"""

from __future__ import annotations

import os
from typing import Any

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI(title="Documind PDF Extract", version="1.0.0")

MIN_USEFUL_CHARS = int(os.environ.get("PDF_MIN_USEFUL_CHARS", "40"))
MAX_PAGES = int(os.environ.get("PDF_MAX_PAGES", "200"))
MAX_CHARS = int(os.environ.get("PDF_MAX_CHARS", "500000"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pdf-extract"}


def extract_with_pymupdf(pdf_bytes: bytes) -> dict[str, Any]:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {exc}") from exc

    page_count = doc.page_count
    if page_count == 0:
        doc.close()
        return {
            "text": None,
            "pageCount": 0,
            "method": "pymupdf",
            "ocrUsed": False,
            "warnings": ["empty_pdf"],
            "reason": "PDF has no pages",
        }

    pages_to_read = min(page_count, MAX_PAGES)
    warnings: list[str] = []
    if page_count > MAX_PAGES:
        warnings.append(f"truncated_to_{MAX_PAGES}_pages")

    parts: list[str] = []
    for i in range(pages_to_read):
        page = doc.load_page(i)
        parts.append(page.get_text("text") or "")
    doc.close()

    text = "\n".join(parts).strip()
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
        warnings.append("truncated_chars")

    if len(text) < MIN_USEFUL_CHARS:
        return {
            "text": None,
            "pageCount": page_count,
            "method": "pymupdf",
            "ocrUsed": False,
            "warnings": warnings + ["insufficient_text"],
            "reason": (
                "No extractable text (scanned/image PDF?). "
                "OCR is not enabled yet (ocr=off)."
            ),
        }

    return {
        "text": text,
        "pageCount": page_count,
        "method": "pymupdf",
        "ocrUsed": False,
        "warnings": warnings,
        "reason": None,
    }


@app.post("/extract")
async def extract(
    request: Request,
    ocr: str = Query(default="off", pattern="^(off|auto|force)$"),
    file: UploadFile | None = File(default=None),
) -> JSONResponse:
    """
    Extract plain text from a PDF.
    F1: only ocr=off is supported; auto/force return 501 until F1b.
    """
    if ocr in ("auto", "force"):
        raise HTTPException(
            status_code=501,
            detail=(
                "OCR not implemented yet (F1). "
                "Use ocr=off for native text extraction; OCR=auto/force comes in F1b."
            ),
        )

    pdf_bytes: bytes
    if file is not None:
        pdf_bytes = await file.read()
    else:
        pdf_bytes = await request.body()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty body")

    # Basic size guard (~50MB)
    max_bytes = int(os.environ.get("PDF_MAX_BYTES", str(50 * 1024 * 1024)))
    if len(pdf_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="PDF too large")

    result = extract_with_pymupdf(pdf_bytes)
    return JSONResponse(result)
