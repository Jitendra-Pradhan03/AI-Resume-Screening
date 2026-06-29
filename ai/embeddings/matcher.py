# ai/embeddings/matcher.py
# Full implementation coming in Step 8 (Embeddings + Cosine Similarity)
from utils.json_helper import success_response
from utils.logger import get_logger

logger = get_logger(__name__)

def match_resume(input_data: dict) -> dict:
    logger.info("match_resume stub called")
    return success_response({
        "overallScore": 0,
        "skillScore": 0,
        "experienceScore": 0,
        "educationScore": 0,
        "weightedFinalScore": 0,
        "matchedSkills": [],
        "missingSkills": [],
        "suggestedSkills": []
    })