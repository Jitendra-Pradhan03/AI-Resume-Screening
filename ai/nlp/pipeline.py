# ai/nlp/pipeline.py
# Full implementation coming in Step 6 (PDF Extraction + NLP Pipeline)
from utils.json_helper import success_response
from utils.logger import get_logger

logger = get_logger(__name__)

def analyze_resume(input_data: dict) -> dict:
    logger.info("analyze_resume stub called")
    return success_response({
        "name": "Stub Result",
        "email": "",
        "phone": "",
        "skills": [],
        "experience": [],
        "education": [],
        "rawText": "Stub — full implementation in Step 6"
    })