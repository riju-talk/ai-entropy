"""
Entropy AI â€” Multilingual Layer

Flow (input non-English):
    Input  â†’  detect language  â†’  translate to English
    Output â†’  translate from English  â†’  target language

Uses deep-translator (Google Translate backend) â€” free, no API key needed.
Reasoning is always performed in English internally for consistency.
"""
from __future__ import annotations
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

try:
    from langdetect import detect, LangDetectException
    _langdetect_available = True
except ImportError:
    logger.warning("langdetect not installed — language detection disabled, defaulting to 'en'")
    _langdetect_available = False

try:
    from deep_translator import GoogleTranslator
    _translator_available = True
except ImportError:
    logger.warning("deep-translator not installed — translation disabled, text will pass through untranslated")
    _translator_available = False

SUPPORTED_LANGUAGES = {
    "hi": "Hindi",
    "bn": "Bengali",
    "te": "Telugu",
    "mr": "Marathi",
    "ta": "Tamil",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "zh-cn": "Chinese (Simplified)",
    "ar": "Arabic",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
}


def detect_language(text: str) -> str:
    """
    Return ISO 639-1 language code.
    Returns 'en' on failure or if langdetect is unavailable.
    """
    if not _langdetect_available:
        return "en"
    try:
        lang = detect(text)
        logger.debug("Detected language: %s", lang)
        return lang
    except Exception:
        logger.warning("Language detection failed, defaulting to 'en'")
        return "en"


async def to_english(text: str, source_lang: str = "auto") -> str:
    """
    Translate text to English.
    source_lang: ISO code or 'auto' for auto-detection.
    """
    if source_lang == "en" or not _translator_available:
        return text
    try:
        translator = GoogleTranslator(source=source_lang, target="en")
        translated = translator.translate(text)
        logger.debug("to_english [%s â†’ en]: %s", source_lang, translated[:80])
        return translated or text
    except Exception as exc:
        logger.error("Translation to English failed: %s", exc)
        return text  # fallback: return original


async def from_english(text: str, target_lang: str) -> str:
    """
    Translate text from English to target language.
    """
    if target_lang == "en" or not _translator_available:
        return text
    try:
        translator = GoogleTranslator(source="en", target=target_lang)
        translated = translator.translate(text)
        logger.debug("from_english [en â†’ %s]: %s", target_lang, translated[:80])
        return translated or text
    except Exception as exc:
        logger.error("Translation from English failed: %s", exc)
        return text  # fallback: return English


async def preprocess(text: str) -> tuple[str, str]:
    """
    Detect language and translate to English.
    Returns (english_text, source_language_code).
    """
    lang = detect_language(text)
    if lang == "en":
        return text, "en"
    english = await to_english(text, source_lang=lang)
    return english, lang


async def postprocess(english_text: str, target_lang: str) -> str:
    """
    Translate final English output back to target language.
    If target is English, returns as-is.
    """
    return await from_english(english_text, target_lang=target_lang)


# ---------------------------------------------------------------------------
# Concept normalisation — always store concepts in English
# ---------------------------------------------------------------------------

def _is_non_english(text: str) -> bool:
    """
    Returns True when >25% of characters fall outside basic Latin / ASCII.
    Covers Devanagari, CJK, Arabic, Cyrillic, etc.
    """
    if not text:
        return False
    non_latin = sum(1 for c in text if ord(c) > 127)
    return (non_latin / len(text)) > 0.25


async def normalize_concept_to_english(concept: str) -> str:
    """
    Guarantee that a concept name is stored in English.

    - If the string is already ASCII/Latin, title-case it and return.
    - If it contains non-Latin characters, translate to English first.

    This is called before every DB and Neo4j write so that concepts are
    always stored as English strings regardless of the user's language.
    """
    concept = concept.strip()
    if not concept:
        return concept

    if not _is_non_english(concept):
        # Already English — just normalise casing
        return concept.title()

    translated = await to_english(concept, source_lang="auto")
    return translated.strip().title()
