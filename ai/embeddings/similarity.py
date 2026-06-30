# ai/embeddings/similarity.py
# Why this file exists: Cosine similarity is the core mathematical operation
# of the entire matching engine. Keeping it isolated makes it easy to test
# and swap out later (e.g. for dot product or euclidean distance).
# Key concept: cosine similarity = dot(A, B) / (||A|| * ||B||)
# Since our model L2-normalises embeddings, ||A|| = ||B|| = 1,
# so cosine similarity reduces to just dot(A, B), ranging from -1 to 1.
# We scale it to 0-100 for the frontend.

import numpy as np
from utils.logger import get_logger

logger = get_logger(__name__)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors.
    Returns a float in [-1, 1]. For semantic embeddings it's always >= 0.
    """
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        logger.warning("Zero vector detected in cosine similarity — returning 0")
        return 0.0

    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def cosine_similarity_score(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Cosine similarity scaled to 0–100 and clamped.
    This is the value we store in MongoDB and show on the dashboard.
    """
    raw = cosine_similarity(vec_a, vec_b)
    # Clamp to [0, 1] then scale to [0, 100]
    scaled = max(0.0, min(1.0, raw)) * 100
    return round(scaled, 2)


def skill_overlap_score(resume_skills: list, jd_skills: list) -> dict:
    """
    Compute skill matching using set intersection.
    This is more precise than embedding similarity for exact skill matches
    because embeddings treat 'python' and 'java' as somewhat similar
    (both are programming languages) — but a recruiter cares about exact matches.

    Returns:
        {
            "score": float (0-100),
            "matchedSkills": [str],
            "missingSkills": [str],
            "suggestedSkills": [str]
        }
    """
    if not jd_skills:
        return {
            "score": 50.0,
            "matchedSkills": resume_skills,
            "missingSkills": [],
            "suggestedSkills": [],
        }

    resume_set = set(s.lower().strip() for s in resume_skills)
    jd_set = set(s.lower().strip() for s in jd_skills)

    matched = sorted(list(resume_set & jd_set))
    missing = sorted(list(jd_set - resume_set))

    # Suggested skills: resume has these but JD didn't ask for them —
    # useful to show the recruiter "this candidate also knows X"
    suggested = sorted(list(resume_set - jd_set))[:8]

    if len(jd_set) == 0:
        score = 100.0
    else:
        score = round((len(matched) / len(jd_set)) * 100, 2)

    return {
        "score": min(score, 100.0),
        "matchedSkills": matched,
        "missingSkills": missing,
        "suggestedSkills": suggested,
    }