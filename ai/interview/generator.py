# ai/interview/generator.py
# Full implementation coming in Step 9 (Interview Question Generator)
from utils.json_helper import success_response
from utils.logger import get_logger

logger = get_logger(__name__)

def generate_questions(input_data: dict) -> dict:
    logger.info("generate_questions stub called")
    return success_response({
        "questions": [
            {
                "question": "Tell me about yourself.",
                "category": "behavioral",
                "difficulty": "easy",
                "relatedSkill": ""
            }
        ]
    })