# ai/nlp/pipeline.py
# Why this file exists: Orchestrates the entire resume analysis pipeline.
# This is the single function that main.py calls for the "analyze_resume"
# action. It runs every extractor in the correct order and assembles
# the final structured result.
# How it connects: Called from main.py, result stored in Candidate.parsedData
# in MongoDB by Node.js after this returns.

from nlp.pdf_extractor import extract_text_from_pdf
from nlp.text_cleaner import clean_text, extract_sections_raw
from nlp.regex_extractor import extract_all_contact_info
from nlp.skill_extractor import extract_skills_from_text, extract_skills_from_section
from nlp.section_parser import parse_education, parse_experience, parse_projects
from utils.json_helper import success_response, error_response
from utils.logger import get_logger

logger = get_logger(__name__)


def analyze_resume(input_data: dict) -> dict:
    """
    Full resume analysis pipeline.

    Input:  { "filePath": "/absolute/path/to/resume.pdf" }
    Output: success_response({ all parsed fields })
    """
    file_path = input_data.get("filePath", "")

    if not file_path:
        return error_response("No filePath provided in input")

    try:
        # ── Stage 1: Extract raw text from PDF ─────────────────────────────
        logger.info("Stage 1: PDF extraction")
        pdf_result = extract_text_from_pdf(file_path)
        raw_text = pdf_result["full_text"]

        # ── Stage 2: Extract contact info via regex (on raw text) ──────────
        logger.info("Stage 2: Regex extraction")
        contact_info = extract_all_contact_info(raw_text)

        # ── Stage 3: Clean text for NLP ────────────────────────────────────
        logger.info("Stage 3: Text cleaning")
        cleaned_text = clean_text(raw_text)

        # ── Stage 4: Split into sections ───────────────────────────────────
        logger.info("Stage 4: Section splitting")
        sections = extract_sections_raw(cleaned_text)

        # ── Stage 5: Extract skills (full text + dedicated skills section) ──
        logger.info("Stage 5: Skill extraction")
        skills_result = extract_skills_from_text(cleaned_text)
        skills_list = skills_result["skills"]

        # If there's a dedicated skills section, run focused extraction too
        if "skills" in sections:
            section_skills = extract_skills_from_section(sections["skills"])
            # Merge and deduplicate
            combined = list(set(skills_list + section_skills))
            skills_list = sorted(combined)

        # ── Stage 6: Parse structured sections ─────────────────────────────
        logger.info("Stage 6: Section parsing")
        education = parse_education(sections.get("education", ""))
        experience = parse_experience(sections.get("experience", ""))
        projects = parse_projects(sections.get("projects", ""))
        summary = sections.get("summary", "")[:500]  # Cap summary at 500 chars

        # ── Stage 7: Assemble final result ─────────────────────────────────
        logger.info("Stage 7: Assembling result")

        parsed_resume = {
            # Contact info from regex
            "name": contact_info["name"],
            "email": contact_info["email"],
            "phone": contact_info["phone"],
            "linkedin": contact_info["linkedin"],
            "github": contact_info["github"],

            # Summary
            "summary": summary,

            # Experience
            "totalExperienceYears": contact_info["totalExperienceYears"],

            # Skills (flat list)
            "skills": skills_list,

            # Structured sections
            "education": education,
            "experience": experience,
            "projects": projects,
            "certifications": contact_info["certifications"],

            # Keep raw text for embedding generation (truncated to 5000 chars)
            "rawText": cleaned_text[:5000],

            # Metadata
            "pageCount": pdf_result["page_count"],
            "fileName": pdf_result["file_name"],
        }

        logger.info(
            f"Analysis complete — name: {parsed_resume['name']}, "
            f"skills: {len(skills_list)}, experience: {len(experience)} entries"
        )

        return success_response(parsed_resume)

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return error_response("Resume file not found", str(e))

    except ValueError as e:
        logger.error(f"Invalid file: {e}")
        return error_response("Invalid or unreadable PDF", str(e))

    except Exception as e:
        logger.error(f"Unexpected error in analyze_resume: {e}", exc_info=True)
        return error_response("Resume analysis failed", str(e))