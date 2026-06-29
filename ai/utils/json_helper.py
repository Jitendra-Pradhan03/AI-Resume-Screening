# ai/utils/json_helper.py
# Why this file exists: Node.js communicates with Python via stdin/stdout.
# This module standardizes how we read input and write output so the
# communication contract is always respected.
# Key concept: Node.js writes a JSON string to the Python process's stdin.
# Python reads it, processes, then writes a JSON result to stdout.
# Node.js captures that stdout and parses it.

import json
import sys
from typing import Any
from utils.logger import get_logger

logger = get_logger(__name__)

def read_input() -> dict:
    """
    Read JSON input piped from Node.js via stdin.
    Node.js sends: { "action": "analyze", "filePath": "...", "jobDescription": "..." }
    """
    try:
        raw = sys.stdin.read()
        if not raw or not raw.strip():
            raise ValueError("No input received from stdin")
        data = json.loads(raw.strip())
        logger.info(f"Input received — action: {data.get('action', 'unknown')}")
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse stdin JSON: {e}")
        raise ValueError(f"Invalid JSON input: {e}")

def write_output(data: Any) -> None:
    """
    Write JSON result to stdout — Node.js will capture this.
    Always call this as the last step in main.py.
    """
    output = json.dumps(data, ensure_ascii=False, default=str)
    sys.stdout.write(output)
    sys.stdout.flush()

def success_response(data: dict) -> dict:
    """Wraps result data in a standard success envelope."""
    return {"success": True, "data": data}

def error_response(message: str, details: str = "") -> dict:
    """Wraps error info in a standard error envelope."""
    return {"success": False, "error": message, "details": details}