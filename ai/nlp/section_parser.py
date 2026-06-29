# ai/nlp/section_parser.py
# Why this file exists: After we split the resume into sections, we need
# to turn unstructured text blocks into structured Python dicts that map
# directly to our Mongoose schema (education[], experience[], projects[]).
# How it connects: Called in analyze_resume() with the section dict from
# text_cleaner.extract_sections_raw().
# Key concept: Heuristic parsing — resumes have no fixed format, so we
# use patterns that are common across most resumes.

import re
from utils.logger import get_logger

logger = get_logger(__name__)


def parse_education(education_text: str) -> list:
    """
    Parse education section into a list of education objects.
    Handles patterns like:
        B.Tech in Computer Science, XYZ University, 2020-2024
        Master of Computer Applications | ABC College | 2022
    """
    if not education_text:
        return []

    education_list = []

    # Common degree keywords
    degree_patterns = [
        r"\b(B\.?Tech|B\.?E\.?|B\.?Sc?\.?|B\.?Com\.?|B\.?A\.?|BCA|BBA)\b",
        r"\b(M\.?Tech|M\.?E\.?|M\.?Sc?\.?|M\.?Com\.?|M\.?A\.?|MCA|MBA|M\.?Phil)\b",
        r"\b(PhD|Ph\.D|Doctor|Doctorate)\b",
        r"\b(Diploma|Certificate|Intermediate|Higher Secondary|Secondary)\b",
        r"\b(Bachelor|Master|Associate|Graduate|Post.?Graduate)\b",
    ]

    lines = [l.strip() for l in education_text.split("\n") if l.strip()]
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line contains a degree keyword
        is_degree_line = any(re.search(p, line, re.IGNORECASE) for p in degree_patterns)

        if is_degree_line:
            edu_entry = {
                "degree": "",
                "field": "",
                "institution": "",
                "year": "",
            }

            # Extract degree
            for pattern in degree_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    edu_entry["degree"] = match.group(0)
                    break

            # Extract year (4-digit number in range 1990-2030)
            year_match = re.search(r"(19|20)\d{2}", line)
            if year_match:
                edu_entry["year"] = year_match.group(0)

            # Extract field of study — text after "in" or "of"
            field_match = re.search(r"\b(?:in|of)\s+([A-Za-z\s&]+?)(?:\s*[,|•\-]|$)", line, re.IGNORECASE)
            if field_match:
                edu_entry["field"] = field_match.group(1).strip()

            # Institution — look on the same line or next line
            # Institutions often follow a comma or pipe
            inst_match = re.search(r"[,|•]\s*([A-Za-z\s,\.]+(?:University|College|Institute|School|Academy)[A-Za-z\s,\.]*)", line, re.IGNORECASE)
            if inst_match:
                edu_entry["institution"] = inst_match.group(1).strip()
            elif i + 1 < len(lines):
                next_line = lines[i + 1]
                if re.search(r"University|College|Institute|School|Academy", next_line, re.IGNORECASE):
                    edu_entry["institution"] = next_line.strip()

            if edu_entry["degree"] or edu_entry["institution"]:
                education_list.append(edu_entry)

        i += 1

    logger.info(f"Parsed {len(education_list)} education entries")
    return education_list[:5]  # Cap at 5


def parse_experience(experience_text: str) -> list:
    """
    Parse work experience into a list of experience objects.
    Handles patterns like:
        Software Engineer at Google Inc. | June 2021 - Present
        Intern, ABC Corp (2020 - 2021)
    """
    if not experience_text:
        return []

    experience_list = []

    # Job title indicators
    title_patterns = [
        r"\b(Software|Senior|Junior|Lead|Principal|Staff|Associate|Assistant)\s+\w+",
        r"\b(Engineer|Developer|Analyst|Designer|Manager|Intern|Consultant|Architect)\b",
        r"\b(Full.?Stack|Front.?End|Back.?End|DevOps|Data|ML|AI|Cloud|QA)\s+\w+",
        r"\b(Trainee|Fresher|Graduate)\b",
    ]

    lines = [l.strip() for l in experience_text.split("\n") if l.strip()]
    i = 0

    while i < len(lines):
        line = lines[i]
        is_title_line = any(re.search(p, line, re.IGNORECASE) for p in title_patterns)

        if is_title_line and len(line) < 120:
            exp_entry = {
                "title": "",
                "company": "",
                "duration": "",
                "description": "",
            }

            # Extract duration (date range)
            duration_match = re.search(
                r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(20\d{2}|19\d{2})\s*[\-–—to]+\s*"
                r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(20\d{2}|19\d{2}|Present|Current|Now)",
                line, re.IGNORECASE
            )
            if duration_match:
                exp_entry["duration"] = duration_match.group(0).strip()

            # Extract title — before company/date indicators
            for pattern in title_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    exp_entry["title"] = match.group(0).strip()
                    break

            # Extract company — look for "at Company" or "Company |" patterns
            company_match = re.search(r"\b(?:at|@)\s+([A-Za-z0-9\s&.,]+?)(?:\s*[|\-–(]|$)", line, re.IGNORECASE)
            if company_match:
                exp_entry["company"] = company_match.group(1).strip()

            # Collect description lines that follow (bullet points)
            desc_lines = []
            j = i + 1
            while j < len(lines) and j < i + 8:
                next_line = lines[j]
                # Stop if we hit another title-like line
                if any(re.search(p, next_line, re.IGNORECASE) for p in title_patterns):
                    break
                if next_line.startswith(("•", "-", "*", "◦")):
                    desc_lines.append(next_line.lstrip("•-*◦ ").strip())
                j += 1

            exp_entry["description"] = " ".join(desc_lines[:3])  # First 3 bullet points

            if exp_entry["title"]:
                experience_list.append(exp_entry)

        i += 1

    logger.info(f"Parsed {len(experience_list)} experience entries")
    return experience_list[:8]  # Cap at 8


def parse_projects(projects_text: str) -> list:
    """
    Parse projects section into structured project objects.
    """
    if not projects_text:
        return []

    projects_list = []
    lines = [l.strip() for l in projects_text.split("\n") if l.strip()]
    i = 0

    while i < len(lines):
        line = lines[i]

        # Project names are usually short lines (under 80 chars) that don't start
        # with bullet points and are followed by a description
        is_project_name = (
            len(line) < 80
            and not line.startswith(("•", "-", "*"))
            and not re.match(r"^\d+\.", line)
            and re.search(r"[A-Z]", line)  # At least one capital letter
        )

        if is_project_name and i + 1 < len(lines):
            project = {
                "name": line,
                "description": "",
                "technologies": [],
            }

            # Collect description
            desc_lines = []
            j = i + 1
            while j < len(lines) and j < i + 6:
                next_line = lines[j]
                if len(next_line) < 60 and not next_line.startswith(("•", "-")):
                    break  # Looks like another project name
                desc_lines.append(next_line.lstrip("•-*◦ ").strip())
                j += 1

            project["description"] = " ".join(desc_lines[:2])

            # Extract technologies from description
            tech_match = re.search(
                r"(?:using|built with|technologies?|tech stack|tools?)[\s:]+([A-Za-z0-9\s,./+#\-]+)",
                " ".join(desc_lines), re.IGNORECASE
            )
            if tech_match:
                techs = [t.strip() for t in re.split(r"[,/|]+", tech_match.group(1)) if t.strip()]
                project["technologies"] = techs[:8]

            if project["name"]:
                projects_list.append(project)
                i = j
                continue

        i += 1

    logger.info(f"Parsed {len(projects_list)} project entries")
    return projects_list[:6]  # Cap at 6