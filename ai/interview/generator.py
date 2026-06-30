# ai/interview/generator.py
# Why this file exists: Orchestrates personalised question generation using
# the candidate's specific skills, experience, and projects as context.
# How it connects: Called from main.py for "generate_questions" action.
# Result stored in Candidate.interviewQuestions in MongoDB by Node.js.
# Key concept: We prioritise questions for skills that appear in BOTH
# the resume and the job description (matched skills) because those are
# most relevant to the interview. We always include a mix of difficulties
# and at least 3 behavioral questions.

import random
from interview.question_bank import (
    SKILL_QUESTIONS,
    EXPERIENCE_QUESTIONS,
    PROJECT_QUESTIONS,
    BEHAVIORAL_QUESTIONS,
)
from utils.json_helper import success_response, error_response
from utils.logger import get_logger

logger = get_logger(__name__)

# Maximum total questions to return
MAX_QUESTIONS = 20
# Minimum behavioral questions always included
MIN_BEHAVIORAL = 3


def _fill_template(template: str, context: dict) -> str:
    """
    Replace {placeholder} tokens in a question template with real values.
    Falls back gracefully if a key is missing.
    """
    try:
        return template.format(**context)
    except KeyError:
        # If a placeholder has no value, leave a readable fallback
        for key, val in context.items():
            template = template.replace("{" + key + "}", val or key)
        return template


def _get_skill_questions(skills: list, matched_skills: list, max_per_skill: int = 3) -> list:
    """
    Generate technical questions for the candidate's skills.
    Prioritises matched skills (in both resume and JD) over unmatched ones.
    For each skill, picks a balanced spread of easy/medium/hard questions.
    """
    questions = []
    seen_questions = set()

    # Sort: matched skills first, then the rest
    matched_set = set(s.lower() for s in (matched_skills or []))
    sorted_skills = sorted(
        skills,
        key=lambda s: (0 if s.lower() in matched_set else 1)
    )

    for skill in sorted_skills[:12]:  # Cap at 12 skills to avoid bloat
        skill_lower = skill.lower()
        skill_context = {"skill": skill}

        # Look for an exact match in our question bank
        template_pool = SKILL_QUESTIONS.get(skill_lower, SKILL_QUESTIONS["default"])

        # Shuffle to avoid always picking the same questions
        pool = list(template_pool)
        random.shuffle(pool)

        added = 0
        for template, difficulty in pool:
            if added >= max_per_skill:
                break

            question_text = _fill_template(template, skill_context)
            if question_text in seen_questions:
                continue

            seen_questions.add(question_text)
            questions.append({
                "question": question_text,
                "category": "technical",
                "difficulty": difficulty,
                "relatedSkill": skill,
            })
            added += 1

    return questions


def _get_experience_questions(experience: list, total_years: float) -> list:
    """
    Generate questions about the candidate's work history.
    Uses the most recent job entry as the primary context.
    """
    if not experience:
        return []

    questions = []
    seen = set()

    # Use the first (most recent) experience entry as primary context
    primary = experience[0] if experience else {}
    context = {
        "title": primary.get("title") or "Software Developer",
        "company": primary.get("company") or "your previous company",
        "years": str(int(total_years)) if total_years > 0 else "a few",
    }

    pool = list(EXPERIENCE_QUESTIONS)
    random.shuffle(pool)

    for template, difficulty, category in pool[:4]:
        text = _fill_template(template, context)
        if text not in seen:
            seen.add(text)
            questions.append({
                "question": text,
                "category": category,
                "difficulty": difficulty,
                "relatedSkill": "experience",
            })

    return questions


def _get_project_questions(projects: list) -> list:
    """
    Generate questions about the candidate's projects.
    Picks the most interesting project (the one with the most technologies).
    """
    if not projects:
        return []

    # Pick the project with the most listed technologies — usually the most complex
    best_project = max(
        projects,
        key=lambda p: len(p.get("technologies") or []),
        default=projects[0],
    )

    project_name = best_project.get("name") or "your portfolio project"
    context = {"project": project_name}

    questions = []
    seen = set()
    pool = list(PROJECT_QUESTIONS)
    random.shuffle(pool)

    for template, difficulty, category in pool[:3]:
        text = _fill_template(template, context)
        if text not in seen:
            seen.add(text)
            questions.append({
                "question": text,
                "category": category,
                "difficulty": difficulty,
                "relatedSkill": "projects",
            })

    return questions


def _get_behavioral_questions(count: int = MIN_BEHAVIORAL) -> list:
    """
    Pick a random selection of behavioral questions.
    Always included regardless of what's on the resume.
    """
    pool = list(BEHAVIORAL_QUESTIONS)
    random.shuffle(pool)

    return [
        {
            "question": template,
            "category": category,
            "difficulty": difficulty,
            "relatedSkill": "behavioral",
        }
        for template, difficulty, category in pool[:count]
    ]


def _balance_by_difficulty(questions: list, max_total: int) -> list:
    """
    Ensure the final question set has a reasonable difficulty distribution.
    Target: ~40% easy, ~40% medium, ~20% hard.
    Shuffles within each tier to keep variety.
    """
    easy = [q for q in questions if q["difficulty"] == "easy"]
    medium = [q for q in questions if q["difficulty"] == "medium"]
    hard = [q for q in questions if q["difficulty"] == "hard"]

    random.shuffle(easy)
    random.shuffle(medium)
    random.shuffle(hard)

    # Take proportional slices
    easy_count = max(2, int(max_total * 0.35))
    hard_count = max(2, int(max_total * 0.20))
    medium_count = max_total - easy_count - hard_count

    balanced = (
        easy[:easy_count]
        + medium[:medium_count]
        + hard[:hard_count]
    )

    # Final shuffle so question order is mixed
    random.shuffle(balanced)
    return balanced[:max_total]


def generate_questions(input_data: dict) -> dict:
    """
    Generate personalised interview questions from parsed resume data.

    Input:
        {
            "parsedResume": dict,       # output from analyze_resume
            "jobDescription": str,      # used to identify matched skills
            "matchedSkills": [str],     # optional — from match step
        }

    Output: success_response({ "questions": [...] })
    """
    parsed_resume = input_data.get("parsedResume")

    if not parsed_resume:
        return error_response("No parsedResume provided")

    try:
        logger.info("Starting interview question generation")

        skills = parsed_resume.get("skills") or []
        experience = parsed_resume.get("experience") or []
        projects = parsed_resume.get("projects") or []
        total_years = parsed_resume.get("totalExperienceYears") or 0

        # matched_skills may come from the match step in full_pipeline
        matched_skills = (
            input_data.get("matchedSkills")
            or input_data.get("parsedResume", {}).get("matchedSkills")
            or []
        )

        if not skills and not experience and not projects:
            logger.warning("Resume has no skills, experience, or projects — returning generic questions")
            questions = _get_behavioral_questions(5)
            return success_response({"questions": questions, "total": len(questions)})

        # ── Generate questions from each source ──────────────────────────────
        skill_qs = _get_skill_questions(skills, matched_skills, max_per_skill=3)
        experience_qs = _get_experience_questions(experience, total_years)
        project_qs = _get_project_questions(projects)
        behavioral_qs = _get_behavioral_questions(MIN_BEHAVIORAL)

        # Combine all
        all_questions = skill_qs + experience_qs + project_qs + behavioral_qs

        # Deduplicate by question text
        seen = set()
        unique = []
        for q in all_questions:
            if q["question"] not in seen:
                seen.add(q["question"])
                unique.append(q)

        # Balance difficulty distribution and cap total
        final_questions = _balance_by_difficulty(unique, MAX_QUESTIONS)

        # Always ensure at least MIN_BEHAVIORAL behavioral questions survive
        behavioral_in_final = [q for q in final_questions if q["category"] == "behavioral"]
        if len(behavioral_in_final) < MIN_BEHAVIORAL:
            extras = [q for q in behavioral_qs if q not in final_questions]
            final_questions = final_questions[: MAX_QUESTIONS - MIN_BEHAVIORAL] + extras[:MIN_BEHAVIORAL]
            random.shuffle(final_questions)

        logger.info(
            f"Generated {len(final_questions)} questions — "
            f"technical: {sum(1 for q in final_questions if q['category'] == 'technical')}, "
            f"behavioral: {sum(1 for q in final_questions if q['category'] == 'behavioral')}, "
            f"experience: {sum(1 for q in final_questions if q['category'] == 'experience')}, "
            f"project: {sum(1 for q in final_questions if q['category'] == 'project')}"
        )

        return success_response({
            "questions": final_questions,
            "total": len(final_questions),
            "breakdown": {
                "technical": sum(1 for q in final_questions if q["category"] == "technical"),
                "behavioral": sum(1 for q in final_questions if q["category"] == "behavioral"),
                "experience": sum(1 for q in final_questions if q["category"] == "experience"),
                "project": sum(1 for q in final_questions if q["category"] == "project"),
                "easy": sum(1 for q in final_questions if q["difficulty"] == "easy"),
                "medium": sum(1 for q in final_questions if q["difficulty"] == "medium"),
                "hard": sum(1 for q in final_questions if q["difficulty"] == "hard"),
            },
        })

    except Exception as e:
        logger.error(f"Question generation failed: {e}", exc_info=True)
        return error_response("Question generation failed", str(e))