# ai/nlp/text_cleaner.py
# Why this file exists: Raw PDF text contains noise — page numbers, repeated
# headers/footers, excessive whitespace, special chars. Cleaning it first
# makes every downstream step (regex, NLP, embeddings) more accurate.
# How it connects: Called after pdf_extractor, before regex_extractor and
# the spaCy NLP pipeline.
# Key concepts: regex substitution, Unicode normalization.

import re
import unicodedata
from utils.logger import get_logger

logger = get_logger(__name__)


def clean_text(raw_text: str) -> str:
    """
    Clean raw PDF text for downstream NLP processing.
    Preserves enough structure (newlines between sections) for the
    section splitter to work correctly.
    """
    if not raw_text:
        return ""

    text = raw_text

    # Normalize unicode — converts curly quotes, em-dashes, etc. to ASCII equivalents
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")

    # Remove URLs (we extract these separately via regex on the raw text)
    text = re.sub(r"http[s]?://\S+", " ", text)

    # Remove email addresses (extracted separately via regex)
    text = re.sub(r"\S+@\S+\.\S+", " ", text)

    # Remove phone numbers (extracted separately via regex)
    text = re.sub(r"[\+\(]?[0-9][0-9\s\-\(\)\.]{8,}[0-9]", " ", text)

    # Remove page numbers (standalone numbers on a line)
    text = re.sub(r"^\s*\d{1,3}\s*$", "", text, flags=re.MULTILINE)

    # Remove special characters but keep hyphens (used in skill names like "next.js")
    # and dots (used in "node.js", version numbers) and slashes (C/C++)
    text = re.sub(r"[^\w\s\-\./,|()+#]", " ", text)

    # Collapse multiple spaces into one
    text = re.sub(r"[ \t]+", " ", text)

    # Collapse more than 2 consecutive newlines into exactly 2
    # This preserves section breaks without excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    return text.strip()


def normalize_for_matching(text: str) -> str:
    """
    Aggressive normalization for skill matching — lowercase, strip all
    punctuation, collapse whitespace. Used when comparing extracted
    text against the skills dataset.
    """
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_sections_raw(text: str) -> dict:
    """
    Split the resume text into named sections using common heading patterns.
    Returns a dict with section names as keys and their text as values.
    This is a heuristic — not every resume follows the same format.
    """
    # Common section heading patterns found in resumes
    section_patterns = [
        r"(EDUCATION|ACADEMIC|QUALIFICATION)",
        r"(EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL EXPERIENCE)",
        r"(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|KEY SKILLS)",
        r"(PROJECTS|PERSONAL PROJECTS|ACADEMIC PROJECTS)",
        r"(CERTIFICATIONS?|CERTIFICATES?|LICENSES?)",
        r"(SUMMARY|OBJECTIVE|PROFILE|ABOUT)",
        r"(ACHIEVEMENTS?|ACCOMPLISHMENTS?|AWARDS?)",
        r"(LANGUAGES?)",
        r"(PUBLICATIONS?|RESEARCH)",
        r"(CONTACT|PERSONAL INFORMATION|PERSONAL DETAILS)",
    ]

    # Build a combined pattern that matches any section header
    combined = "|".join([f"(?P<{re.sub(r'[^A-Z]', '', p.split('|')[0].lstrip('('))}>{p})" for p in section_patterns])
    header_re = re.compile(
        r"^[ \t]*(" + "|".join(section_patterns) + r")[\s:]*$",
        re.IGNORECASE | re.MULTILINE
    )

    sections = {}
    last_key = "header"
    last_pos = 0

    for match in header_re.finditer(text):
        # Save the text before this heading
        section_text = text[last_pos:match.start()].strip()
        if section_text:
            sections[last_key] = section_text

        # Normalize the heading name to a simple key
        heading = match.group().strip().upper()
        if any(k in heading for k in ["EDUCATION", "ACADEMIC", "QUALIFICATION"]):
            last_key = "education"
        elif any(k in heading for k in ["EXPERIENCE", "EMPLOYMENT", "WORK"]):
            last_key = "experience"
        elif any(k in heading for k in ["SKILL", "COMPETENC", "TECHNICAL"]):
            last_key = "skills"
        elif any(k in heading for k in ["PROJECT"]):
            last_key = "projects"
        elif any(k in heading for k in ["CERTIF", "LICENSE"]):
            last_key = "certifications"
        elif any(k in heading for k in ["SUMMARY", "OBJECTIVE", "PROFILE", "ABOUT"]):
            last_key = "summary"
        elif any(k in heading for k in ["ACHIEVEMENT", "AWARD"]):
            last_key = "achievements"
        else:
            last_key = heading.lower().split()[0]

        last_pos = match.end()

    # Save the final section
    remaining = text[last_pos:].strip()
    if remaining:
        sections[last_key] = remaining

    logger.info(f"Sections found: {list(sections.keys())}")
    return sections