"""
Documind PDF text extraction service (F1 + F1b).

- Native text: PyMuPDF (fast)
- OCR when needed: render pages with PyMuPDF → Tesseract (pytesseract)
  (avoids OCRmyPDF/pikepdf version breakage)

POST /extract?ocr=off|auto|force
"""

from __future__ import annotations

import logging
import os
from typing import Any

import fitz  # PyMuPDF
import pytesseract
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pdf-extract")

app = FastAPI(title="Documind PDF Extract", version="1.1.1")

MIN_USEFUL_CHARS = int(os.environ.get("PDF_MIN_USEFUL_CHARS", "40"))
MAX_PAGES = int(os.environ.get("PDF_MAX_PAGES", "200"))
OCR_MAX_PAGES = int(os.environ.get("PDF_OCR_MAX_PAGES", "30"))
MAX_CHARS = int(os.environ.get("PDF_MAX_CHARS", "500000"))
OCR_LANG = os.environ.get("PDF_OCR_LANG", "eng")
TESSERACT_TIMEOUT = int(os.environ.get("PDF_TESSERACT_TIMEOUT", "180"))
# 2.0 ≈ 144 DPI-ish boost; higher = better OCR, slower
OCR_ZOOM = float(os.environ.get("PDF_OCR_ZOOM", "2.0"))


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "pdf-extract",
        "ocr": True,
        "ocrEngine": "tesseract",
        "ocrMaxPages": OCR_MAX_PAGES,
        "ocrLang": OCR_LANG,
    }


def _cap_text(text: str, warnings: list[str]) -> str:
    text = text.strip()
    if len(text) > MAX_CHARS:
        warnings.append("truncated_chars")
        return text[:MAX_CHARS]
    return text


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

    text = _cap_text("\n".join(parts), warnings)

    if len(text) < MIN_USEFUL_CHARS:
        return {
            "text": None,
            "pageCount": page_count,
            "method": "pymupdf",
            "ocrUsed": False,
            "warnings": warnings + ["insufficient_text"],
            "reason": (
                "No extractable native text (scanned/image PDF?). "
                "Use ocr=auto or ocr=force for OCR."
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


def extract_with_ocr(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Render each page to an image (PyMuPDF), then Tesseract OCR.
    More reliable than OCRmyPDF for simple screenshot PDFs; free/local.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {exc}") from exc

    page_count = doc.page_count
    warnings: list[str] = []
    if page_count == 0:
        doc.close()
        return {
            "text": None,
            "pageCount": 0,
            "method": "ocr_tesseract",
            "ocrUsed": True,
            "warnings": ["empty_pdf"],
            "reason": "PDF has no pages",
        }

    pages_to_ocr = min(page_count, OCR_MAX_PAGES)
    if page_count > OCR_MAX_PAGES:
        warnings.append(f"ocr_truncated_to_{OCR_MAX_PAGES}_pages")

    matrix = fitz.Matrix(OCR_ZOOM, OCR_ZOOM)
    parts: list[str] = []

    try:
        for i in range(pages_to_ocr):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            try:
                page_text = pytesseract.image_to_string(
                    img,
                    lang=OCR_LANG,
                    timeout=TESSERACT_TIMEOUT,
                )
            except RuntimeError as exc:
                # tesseract timeout
                warnings.append(f"ocr_timeout_page_{i + 1}")
                log.warning("Tesseract timeout on page %s: %s", i + 1, exc)
                page_text = ""
            except Exception as exc:  # noqa: BLE001
                warnings.append(f"ocr_error_page_{i + 1}")
                log.warning("Tesseract failed on page %s: %s", i + 1, exc)
                page_text = ""
            parts.append(page_text or "")
    finally:
        doc.close()

    text = _cap_text("\n".join(parts), warnings)

    if len(text) < MIN_USEFUL_CHARS:
        return {
            "text": None,
            "pageCount": page_count,
            "method": "ocr_tesseract",
            "ocrUsed": True,
            "warnings": warnings + ["ocr_insufficient_text"],
            "reason": (
                "OCR ran but found almost no readable text "
                "(blurry screenshot, tiny font, or blank image)."
            ),
        }

    return {
        "text": text,
        "pageCount": page_count,
        "method": "ocr_tesseract",
        "ocrUsed": True,
        "warnings": warnings,
        "reason": None,
    }


@app.post("/extract")
async def extract(
    request: Request,
    ocr: str = Query(default="auto", pattern="^(off|auto|force)$"),
    file: UploadFile | None = File(default=None),
) -> JSONResponse:
    """
    - off: native text only
    - auto: native first; OCR if insufficient
    - force: always OCR
    """
    if file is not None:
        pdf_bytes = await file.read()
    else:
        pdf_bytes = await request.body()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty body")

    max_bytes = int(os.environ.get("PDF_MAX_BYTES", str(50 * 1024 * 1024)))
    if len(pdf_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="PDF too large")

    if ocr == "force":
        return JSONResponse(extract_with_ocr(pdf_bytes))

    native = extract_with_pymupdf(pdf_bytes)

    if ocr == "off":
        return JSONResponse(native)

    # ocr=auto
    if native["text"] is not None:
        return JSONResponse(native)

    log.info("Native text insufficient; running Tesseract OCR (lang=%s)", OCR_LANG)
    ocr_result = extract_with_ocr(pdf_bytes)
    ocr_result["warnings"] = list(
        dict.fromkeys(
            (native.get("warnings") or [])
            + ["fallback_ocr"]
            + (ocr_result.get("warnings") or [])
        )
    )
    return JSONResponse(ocr_result)
