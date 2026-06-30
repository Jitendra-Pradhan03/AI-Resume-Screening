# ai/embeddings/skill_extractor_jd.py
# Why this file exists: We need to pull skills out of the job description
# the same way we pull them from resumes. Reusing the same logic ensures
# apples-to-apples comparison.
# How it connects: Called in matcher.py before computing skill overlap.

import re
from data.skills_dataset import ALL_SKILLS
from utils.logger import get_logger

logger = get_logger(__name__)


def extract_skills_from_jd(jd_text: str) -> list:
    """
    Extract skill keywords from a job description.
    Uses the same dataset-matching approach as the resume skill extractor.
    """
    if not jd_text:
        return []

    normalized = jd_text.lower()
    found = set()

    for skill in ALL_SKILLS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, normalized):
            found.add(skill.lower())

    skills = sorted(list(found))
    logger.info(f"Extracted {len(skills)} skills from job description")
    return skills


def estimate_experience_requirement(jd_text: str) -> float:
    """
    Parse years-of-experience requirement from JD text.
    e.g. "3+ years", "minimum 2 years", "5 years of experience"
    Returns the number of years required (0 if not found).
    """
    patterns = [
        r"(\d+)\+?\s*years?\s+of\s+experience",
        r"(\d+)\+?\s*years?\s+experience",
        r"minimum\s+(\d+)\s*years?",
        r"at\s+least\s+(\d+)\s*years?",
        r"(\d+)\s*\-\s*\d+\s*years?\s+of\s+experience",
    ]

    for pattern in patterns:
        match = re.search(pattern, jd_text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue

    return 0.0


def extract_education_requirement(jd_text: str) -> str:
    """
    Detect the education level required in the JD.
    Returns a normalized string like "bachelor", "master", "phd", or "any".
    """
    jd_lower = jd_text.lower()

    if any(kw in jd_lower for kw in ["phd", "ph.d", "doctorate", "doctoral"]):
        return "phd"
    if any(kw in jd_lower for kw in ["master", "m.tech", "mca", "mba", "m.sc", "postgraduate"]):
        return "master"
    if any(kw in jd_lower for kw in ["bachelor", "b.tech", "b.e", "b.sc", "bca", "undergraduate", "degree"]):
        return "bachelor"
    if any(kw in jd_lower for kw in ["diploma", "12th", "hsc", "intermediate"]):
        return "diploma"

    return "any"