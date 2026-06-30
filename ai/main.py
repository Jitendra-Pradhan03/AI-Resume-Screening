# ai/main.py
# Why this file exists: This is the single entry point that Node.js calls.
# It reads what action to perform from stdin JSON, runs the right pipeline,
# and writes the result to stdout for Node.js to capture.
# How it connects: node server calls: python ai/main.py
# and pipes JSON to its stdin, then reads the stdout.
# Key concept: Action-based routing — one entry point handles multiple
# operations (analyze resume, generate questions, match scores).

import sys
import os

# Ensure the ai/ directory is in Python's module search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.json_helper import read_input, write_output, success_response, error_response
from utils.logger import get_logger

logger = get_logger(__name__)

def run():
    try:
        # Step 1: Read the JSON payload sent by Node.js via stdin
        input_data = read_input()
        action = input_data.get("action")

        if not action:
            write_output(error_response("No action specified in input"))
            return

        logger.info(f"Running action: {action}")

        # Step 2: Route to the correct pipeline based on action
        if action == "analyze_resume":
            from nlp.pipeline import analyze_resume
            result = analyze_resume(input_data)

        elif action == "match_resume":
            from embeddings.matcher import match_resume
            result = match_resume(input_data)

        elif action == "generate_questions":
            from interview.generator import generate_questions
            result = generate_questions(input_data)

        elif action == "full_pipeline":
            # Runs analyze + match + generate in one call (most common usage)
            from nlp.pipeline import analyze_resume
            from embeddings.matcher import match_resume
            from interview.generator import generate_questions

            # Stage 1: Parse and analyze the resume
            analysis = analyze_resume(input_data)
            if not analysis.get("success"):
                write_output(analysis)
                return

            # Stage 2: Match against the job description
            match_input = {
                **input_data,
                "parsedResume": analysis["data"],
            }

            match_result = match_resume(match_input)
            if not match_result.get("success"):
                write_output(match_result)
                return

            # Stage 3: Generate interview questions.
            # Pass matched skills so the generator can prioritize
            # questions relevant to the job description.
            question_input = {
                **input_data,
                "parsedResume": analysis["data"],
                "matchedSkills": match_result["data"].get("matchedSkills", []),
            }

            questions_result = generate_questions(question_input)

            # Combine all pipeline outputs into one response
            result = success_response({
                "parsedResume": analysis["data"],
                "matchScore": match_result["data"],
                "interviewQuestions": questions_result.get("data", {}).get("questions", []),
                "questionBreakdown": questions_result.get("data", {}).get("breakdown", {}),
            })
            
        else:
            result = error_response(f"Unknown action: {action}")

        # Step 3: Write the result to stdout for Node.js to capture
        write_output(result)

    except Exception as e:
        logger.error(f"Unhandled error in main.py: {e}", exc_info=True)
        write_output(error_response("Internal AI error", str(e)))

if __name__ == "__main__":
    run()