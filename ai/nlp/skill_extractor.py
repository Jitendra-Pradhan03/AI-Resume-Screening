# ai/nlp/skill_extractor.py
# Why this file exists: Skills are the most important signal for matching
# a resume to a job. We use two strategies: (1) direct substring match
# against the skills dataset, and (2) spaCy token-level NLP match for
# multi-word skills. Both together give much better recall than either alone.
# How it connects: Called in analyze_resume() on the cleaned text.
# Key concept: We normalize both the resume text and the skill names to
# lowercase before comparing so "Python" and "python" both match.

import re
from data.skills_dataset import ALL_SKILLS, SKILLS_BY_CATEGORY
from utils.logger import get_logger

logger = get_logger(__name__)


def extract_skills_from_text(text: str) -> dict:
    """
    Extract skills from resume text using two-pass matching.

    Pass 1: Direct substring match (fast, handles multi-word skills like "machine learning")
    Pass 2: Token-level match (handles skills embedded in sentences)

    Returns:
        {
            "skills": [str],                     # deduplicated flat list
            "skillsByCategory": {category: [str]}  # grouped by category
        }
    """
    if not text:
        return {"skills": [], "skillsByCategory": {}}

    normalized_text = text.lower()
    found_skills = set()

    # ── Pass 1: Direct substring match ─────────────────────────────────────
    # Works well for multi-word skills: "machine learning", "react native", etc.
    for skill in ALL_SKILLS:
        skill_lower = skill.lower()
        # Use word boundaries to avoid matching "r" inside "for" or "java" in "javascript"
        pattern = r"\b" + re.escape(skill_lower) + r"\b"
        if re.search(pattern, normalized_text):
            found_skills.add(skill_lower)

    # ── Pass 2: spaCy NLP token match ──────────────────────────────────────
    # Catches skills that might not match exactly due to compound sentences
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        doc = nlp(text[:10000])  # Limit to 10k chars for speed

        # Extract noun chunks and individual tokens as candidate skill phrases
        candidates = set()
        for chunk in doc.noun_chunks:
            candidates.add(chunk.text.lower().strip())
        for token in doc:
            if token.pos_ in ("NOUN", "PROPN") and not token.is_stop:
                candidates.add(token.lemma_.lower().strip())

        # Check candidates against skills dataset
        for candidate in candidates:
            for skill in ALL_SKILLS:
                if candidate == skill.lower() or candidate == skill.lower().replace("-", " "):
                    found_skills.add(skill.lower())

    except Exception as e:
        logger.warning(f"spaCy NLP pass failed (falling back to regex only): {e}")

    # ── Group by category ───────────────────────────────────────────────────
    by_category = {}
    for category, cat_skills in SKILLS_BY_CATEGORY.items():
        matched = [s for s in cat_skills if s.lower() in found_skills]
        if matched:
            by_category[category] = matched

    skills_list = sorted(list(found_skills))
    logger.info(f"Extracted {len(skills_list)} skills")

    return {
        "skills": skills_list,
        "skillsByCategory": by_category,
    }


def extract_skills_from_section(section_text: str) -> list:
    """
    Focused skill extraction from a dedicated skills section of the resume.
    Resumes often list skills as comma-separated or bullet-pointed lists.
    This handles that pattern more accurately.
    """
    if not section_text:
        return []

    found = set()
    normalized = section_text.lower()

    # Skills sections often use: Python, Node.js, React | AWS, Docker
    # Split by common delimiters
    tokens = re.split(r"[,|•·\n/\\]+", normalized)

    for token in tokens:
        token = token.strip()
        if not token or len(token) < 2:
            continue
        # Check if the token (or a close match) is in our skills list
        for skill in ALL_SKILLS:
            if token == skill.lower() or token.replace(" ", "") == skill.lower().replace(" ", ""):
                found.add(skill.lower())
                break

    return sorted(list(found))