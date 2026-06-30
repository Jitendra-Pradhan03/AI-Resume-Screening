# ai/embeddings/matcher.py
# Why this file exists: Orchestrates the entire matching pipeline —
# encodes both texts, computes multiple similarity scores, applies weights,
# and returns a final structured score object.
# How it connects: Called from main.py for "match_resume" and
# "full_pipeline" actions. Result stored in Candidate.matchScore in MongoDB.
# Key concept: Weighted scoring — different dimensions (skills, experience,
# education, semantic similarity) contribute different amounts to the final
# score based on what recruiters care about most.

from embeddings.encoder import encode_text
from embeddings.similarity import cosine_similarity_score, skill_overlap_score
from embeddings.skill_extractor_jd import (
    extract_skills_from_jd,
    estimate_experience_requirement,
    extract_education_requirement,
)
from utils.json_helper import success_response, error_response
from utils.logger import get_logger

logger = get_logger(__name__)

# ── Score weights ────────────────────────────────────────────────────────────
# These must sum to 1.0. Adjust based on what your recruiters prioritise.
WEIGHTS = {
    "skill": 0.40,        # Exact skill match — highest weight (most objective)
    "semantic": 0.30,     # Embedding similarity — overall content match
    "experience": 0.20,   # Years of experience vs requirement
    "education": 0.10,    # Education level vs requirement
}


def _score_experience(candidate_years: float, required_years: float) -> float:
    """
    Score experience on a 0-100 scale.
    - Meets or exceeds requirement → high score
    - Under by 1 year → moderate penalty
    - Under by 2+ years → significant penalty
    - No requirement in JD → neutral 70
    """
    if required_years <= 0:
        return 70.0  # No requirement stated — give a neutral score

    if candidate_years >= required_years:
        # Exceeding by more than 50% gives diminishing returns
        excess_ratio = candidate_years / required_years
        return min(100.0, 85.0 + (excess_ratio - 1.0) * 10.0)

    # Under-qualified — scale down
    ratio = candidate_years / required_years
    return round(max(0.0, ratio * 80.0), 2)


def _score_education(candidate_education: list, required_level: str) -> float:
    """
    Score education on a 0-100 scale.
    Maps education entries to a level hierarchy and checks if the candidate
    meets the requirement.
    """
    if required_level == "any" or not candidate_education:
        return 70.0

    # Hierarchy: diploma < bachelor < master < phd
    level_map = {"diploma": 1, "bachelor": 2, "master": 3, "phd": 4}
    required_num = level_map.get(required_level, 2)

    candidate_max = 0
    for edu in candidate_education:
        degree = (edu.get("degree") or "").lower()
        field = (edu.get("field") or "").lower()
        combined = f"{degree} {field}"

        if any(kw in combined for kw in ["phd", "ph.d", "doctor"]):
            candidate_max = max(candidate_max, 4)
        elif any(kw in combined for kw in ["master", "m.tech", "mca", "mba", "m.sc"]):
            candidate_max = max(candidate_max, 3)
        elif any(kw in combined for kw in ["bachelor", "b.tech", "b.e", "b.sc", "bca", "degree"]):
            candidate_max = max(candidate_max, 2)
        elif any(kw in combined for kw in ["diploma", "intermediate"]):
            candidate_max = max(candidate_max, 1)

    if candidate_max >= required_num:
        return 90.0 + (candidate_max - required_num) * 5.0
    else:
        gap = required_num - candidate_max
        return max(30.0, 70.0 - gap * 20.0)


def match_resume(input_data: dict) -> dict:
    """
    Match a resume against a job description and produce weighted scores.

    Input:
        {
            "jobDescription": str,          # Full JD text
            "parsedResume": dict | None,    # Already-parsed resume (from full_pipeline)
            "filePath": str | None          # Used only if parsedResume is None
        }

    Output: success_response({ matchScore object })
    """
    job_description = input_data.get("jobDescription", "")
    parsed_resume = input_data.get("parsedResume")

    if not job_description or not job_description.strip():
        return error_response("No job description provided")

    if not parsed_resume:
        return error_response(
            "No parsed resume data provided. Run analyze_resume first or use full_pipeline."
        )

    try:
        logger.info("Starting resume matching pipeline")

        # ── 1. Extract data from parsed resume ──────────────────────────────
        resume_skills = parsed_resume.get("skills", [])
        resume_raw_text = parsed_resume.get("rawText", "")
        resume_education = parsed_resume.get("education", [])
        candidate_exp_years = parsed_resume.get("totalExperienceYears", 0)

        # Build a rich text representation for semantic embedding
        # We combine rawText with skills for better embedding quality
        resume_text_for_embedding = (
            resume_raw_text + "\n\nSkills: " + ", ".join(resume_skills)
        ).strip()

        if not resume_text_for_embedding:
            return error_response("Resume has no extractable text for matching")

        # ── 2. Extract requirements from job description ─────────────────────
        logger.info("Extracting JD requirements")
        jd_skills = extract_skills_from_jd(job_description)
        required_exp_years = estimate_experience_requirement(job_description)
        required_education = extract_education_requirement(job_description)

        # ── 3. Generate embeddings for both texts ────────────────────────────
        logger.info("Generating embeddings")
        resume_embedding = encode_text(resume_text_for_embedding[:3000])
        jd_embedding = encode_text(job_description[:3000])

        # ── 4. Compute individual scores ─────────────────────────────────────
        logger.info("Computing similarity scores")

        # Semantic similarity (embedding cosine)
        semantic_score = cosine_similarity_score(resume_embedding, jd_embedding)

        # Skill overlap (exact match)
        skill_result = skill_overlap_score(resume_skills, jd_skills)
        skill_score = skill_result["score"]

        # Experience score
        experience_score = _score_experience(candidate_exp_years, required_exp_years)

        # Education score
        education_score = _score_education(resume_education, required_education)

        # ── 5. Compute weighted final score ──────────────────────────────────
        weighted_final = (
            skill_score * WEIGHTS["skill"]
            + semantic_score * WEIGHTS["semantic"]
            + experience_score * WEIGHTS["experience"]
            + education_score * WEIGHTS["education"]
        )
        weighted_final = round(min(100.0, max(0.0, weighted_final)), 2)

        # ── 6. Assemble result ───────────────────────────────────────────────
        result = {
            "overallScore": round(semantic_score, 2),
            "skillScore": round(skill_score, 2),
            "experienceScore": round(experience_score, 2),
            "educationScore": round(education_score, 2),
            "weightedFinalScore": weighted_final,
            "matchedSkills": skill_result["matchedSkills"],
            "missingSkills": skill_result["missingSkills"],
            "suggestedSkills": skill_result["suggestedSkills"],
            "jdSkillsFound": jd_skills,
            "requiredExperienceYears": required_exp_years,
            "requiredEducation": required_education,
            "scoreBreakdown": {
                "skillWeight": WEIGHTS["skill"],
                "semanticWeight": WEIGHTS["semantic"],
                "experienceWeight": WEIGHTS["experience"],
                "educationWeight": WEIGHTS["education"],
                "rawScores": {
                    "skill": round(skill_score, 2),
                    "semantic": round(semantic_score, 2),
                    "experience": round(experience_score, 2),
                    "education": round(education_score, 2),
                },
            },
        }

        logger.info(
            f"Matching complete — final score: {weighted_final} "
            f"(skill: {skill_score}, semantic: {semantic_score}, "
            f"exp: {experience_score}, edu: {education_score})"
        )

        return success_response(result)

    except Exception as e:
        logger.error(f"Matching failed: {e}", exc_info=True)
        return error_response("Resume matching failed", str(e))