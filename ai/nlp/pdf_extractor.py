# ai/nlp/pdf_extractor.py
# Why this file exists: PyMuPDF (fitz) is the best Python library for
# extracting clean text from PDFs. It handles multi-column layouts,
# preserves reading order, and ignores embedded images cleanly.
# How it connects: Called first in the analyze_resume pipeline.
# Returns the full raw text plus a per-page breakdown.
# Key concept: PDFs store text as positioned glyphs, not lines.
# PyMuPDF's get_text("text") reassembles them into readable lines.

import fitz  # PyMuPDF
import os
from utils.logger import get_logger

logger = get_logger(__name__)


def extract_text_from_pdf(file_path: str) -> dict:
    """
    Extract all text from a PDF file.

    Returns:
        {
            "full_text": str,        # entire resume as one string
            "pages": [str, ...],     # text per page
            "page_count": int,
            "file_name": str
        }
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF not found: {file_path}")

    if not file_path.lower().endswith(".pdf"):
        raise ValueError(f"File is not a PDF: {file_path}")

    logger.info(f"Extracting text from: {file_path}")

    try:
        doc = fitz.open(file_path)
        pages_text = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            # "text" mode preserves reading order better than "blocks" for resumes
            text = page.get_text("text")
            pages_text.append(text)

        doc.close()

        full_text = "\n".join(pages_text)

        if not full_text.strip():
            raise ValueError("PDF appears to be empty or image-only (no extractable text)")

        logger.info(f"Extracted {len(full_text)} characters from {len(pages_text)} page(s)")

        return {
            "full_text": full_text,
            "pages": pages_text,
            "page_count": len(pages_text),
            "file_name": os.path.basename(file_path),
        }

    except fitz.FileDataError:
        raise ValueError("File is corrupted or not a valid PDF")
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise