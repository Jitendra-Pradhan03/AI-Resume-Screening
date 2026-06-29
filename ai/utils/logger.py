# ai/utils/logger.py
# Why this file exists: Provides consistent logging across all Python modules.
# Python's built-in logging module is better than print() because it
# includes timestamps, levels (INFO/ERROR/DEBUG), and can write to files.
# How it connects: Imported by every Python module that needs to log.

import logging
import sys
import os

def get_logger(name: str) -> logging.Logger:
    """
    Returns a configured logger for the given module name.
    Usage: logger = get_logger(__name__)
    """
    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers if this is called multiple times
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG if os.getenv("DEBUG") == "true" else logging.INFO)

    # Console handler — writes to stderr so it doesn't pollute stdout
    # (stdout is reserved for the JSON result that Node.js reads)
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s %(name)s — %(message)s",
        datefmt="%H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger