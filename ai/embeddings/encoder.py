# ai/embeddings/encoder.py
# Why this file exists: Generating embeddings is the same operation whether
# we're encoding a resume or a job description. Centralising it here means
# the model is loaded once and reused across calls — loading it takes ~2s
# so we never want to do it twice in one pipeline run.
# Key concept: sentence-transformers converts any text into a fixed-size
# vector (384 numbers for all-MiniLM-L6-v2). Texts that are semantically
# similar end up with vectors that point in the same direction in that
# 384-dimensional space. Cosine similarity measures that angular closeness.

from sentence_transformers import SentenceTransformer
from utils.logger import get_logger
import numpy as np

logger = get_logger(__name__)

# Module-level singleton — loaded once, reused across the entire pipeline run
_model = None

def get_model() -> SentenceTransformer:
    """
    Lazy-load the sentence transformer model.
    Using a module-level singleton avoids re-loading on every call.
    """
    global _model
    if _model is None:
        logger.info("Loading sentence-transformer model: all-MiniLM-L6-v2")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded successfully")
    return _model


def encode_text(text: str) -> np.ndarray:
    """
    Encode a single text string into a 384-dimensional embedding vector.
    The vector is L2-normalised by the model, which makes cosine similarity
    equivalent to a simple dot product.

    Args:
        text: Any string (resume text, job description, skill list)
    Returns:
        numpy array of shape (384,)
    """
    if not text or not text.strip():
        logger.warning("encode_text received empty string — returning zero vector")
        return np.zeros(384)

    model = get_model()
    # convert_to_numpy=True returns an ndarray directly
    embedding = model.encode(text.strip(), convert_to_numpy=True)
    logger.info(f"Encoded text ({len(text)} chars) → vector shape {embedding.shape}")
    return embedding


def encode_texts(texts: list) -> np.ndarray:
    """
    Encode a list of texts in one batch — faster than calling encode_text
    in a loop because the model processes them together on the GPU/CPU.

    Returns:
        numpy array of shape (len(texts), 384)
    """
    if not texts:
        return np.zeros((0, 384))

    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return embeddings