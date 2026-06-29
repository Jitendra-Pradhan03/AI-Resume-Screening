# ai/nlp/regex_extractor.py
# Why this file exists: Contact details like email, phone, LinkedIn, and
# GitHub have predictable formats — regex is faster and more precise than
# NLP for these. We run regex on the RAW text before cleaning so we
# don't accidentally remove the patterns we're looking for.
# How it connects: Called in analyze_resume() alongside the NLP pipeline.
# Key concept: Named capture groups in regex make results easy to read.

import re
from utils.logger import get_logger

logger = get_logger(__name__)


def extract_email(text: str) -> str:
    """Extract the first email address found in the text."""
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    match = re.search(pattern, text)
    return match.group(0).lower() if match else ""


def extract_phone(text: str) -> str:
    """
    Extract a phone number. Handles formats like:
    +91-9876543210, (123) 456-7890, 9876543210, +1 234 567 8900
    """
    pattern = r"(\+?\d{1,3}[\s\-]?)?(\(?\d{3}\)?[\s\-]?)(\d{3}[\s\-]?\d{4}|\d{4}[\s\-]?\d{4}|\d{4,6})"
    matches = re.findall(pattern, text)
    for match in matches:
        phone = "".join(match).strip()
        digits = re.sub(r"\D", "", phone)
        # Valid phone: 10-15 digits
        if 10 <= len(digits) <= 15:
            return phone
    return ""


def extract_linkedin(text: str) -> str:
    """Extract a LinkedIn profile URL."""
    pattern = r"(https?://)?(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(0) if match else ""


def extract_github(text: str) -> str:
    """Extract a GitHub profile URL."""
    pattern = r"(https?://)?(www\.)?github\.com/[A-Za-z0-9\-_]+"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(0) if match else ""


def extract_name(text: str) -> str:
    """
    Heuristic name extraction: the candidate's name is almost always
    the first non-empty, non-contact-info line of the resume.
    We take the first line that looks like a name (2-4 words, all alpha).
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines[:10]:  # Only look in the first 10 lines
        # Skip lines that are clearly not names
        if "@" in line or "http" in line.lower():
            continue
        if re.search(r"\d", line):  # Contains a digit — likely not a name
            continue
        if len(line) > 60:  # Too long to be just a name
            continue

        words = line.split()
        # A name is typically 2-4 words made of letters (and maybe a dot or hyphen)
        if 2 <= len(words) <= 4:
            if all(re.match(r"^[A-Za-z][A-Za-z.\-']*$", w) for w in words):
                return line.title()

    return ""


def extract_total_experience_years(text: str) -> float:
    """
    Estimate total years of experience by scanning for year patterns
    in the experience section. Looks for date ranges like "2018 - 2022"
    or "Jan 2019 – Present".
    """
    # Pattern: year ranges like 2018-2022 or 2019 - present
    year_range_pattern = r"(20\d{2}|19\d{2})\s*[\-–—to]+\s*(20\d{2}|19\d{2}|present|current|now)"
    matches = re.findall(year_range_pattern, text, re.IGNORECASE)

    import datetime
    current_year = datetime.datetime.now().year
    total_years = 0.0

    for start_str, end_str in matches:
        try:
            start = int(start_str)
            if re.match(r"present|current|now", end_str, re.IGNORECASE):
                end = current_year
            else:
                end = int(end_str)

            if 1990 <= start <= current_year and start <= end <= current_year + 1:
                total_years += end - start
        except ValueError:
            continue

    return round(min(total_years, 40), 1)  # Cap at 40 to filter outliers


def extract_certifications(text: str) -> list:
    """
    Extract certifications by looking for common cert keywords
    and the lines that follow them.
    """
    cert_keywords = [
        r"aws certified", r"google certified", r"microsoft certified",
        r"azure", r"comptia", r"cisco", r"pmp", r"scrum master",
        r"oracle certified", r"tensorflow", r"coursera", r"udemy",
        r"nptel", r"certification in", r"certified in", r"certificate in"
    ]

    found = []
    lines = text.split("\n")

    for i, line in enumerate(lines):
        line_lower = line.lower()
        for keyword in cert_keywords:
            if re.search(keyword, line_lower):
                cert = line.strip()
                if cert and len(cert) > 5 and cert not in found:
                    found.append(cert)
                break

    return found[:10]  # Cap at 10


def extract_all_contact_info(raw_text: str) -> dict:
    """
    Run all regex extractors on the raw text and return a clean dict.
    Called once from the main pipeline.
    """
    logger.info("Running regex extraction for contact info")

    return {
        "name": extract_name(raw_text),
        "email": extract_email(raw_text),
        "phone": extract_phone(raw_text),
        "linkedin": extract_linkedin(raw_text),
        "github": extract_github(raw_text),
        "totalExperienceYears": extract_total_experience_years(raw_text),
        "certifications": extract_certifications(raw_text),
    }